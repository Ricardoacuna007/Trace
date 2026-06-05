use std::{
    net::TcpListener,
    path::PathBuf,
    process::{Child, Command, Stdio},
    time::Duration,
};

use reqwest::{Client, StatusCode};
use serde_json::{json, Value};
use uuid::Uuid;

struct TestServer {
    base_url: String,
    child: Child,
    data_dir: PathBuf,
}

impl TestServer {
    async fn start() -> Self {
        let port = unused_port();
        let data_dir = std::env::temp_dir().join(format!("trace-api-test-{}", Uuid::new_v4()));
        let bind = format!("127.0.0.1:{port}");
        let child = Command::new(env!("CARGO_BIN_EXE_trace-server"))
            .env("TRACE_DATA_DIR", &data_dir)
            .env("TRACE_BIND", &bind)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("trace-server starts");
        let server = Self {
            base_url: format!("http://{bind}"),
            child,
            data_dir,
        };
        server.wait_for_health().await;
        server
    }

    async fn wait_for_health(&self) {
        let client = Client::new();
        for _ in 0..60 {
            if let Ok(response) = client.get(format!("{}/health", self.base_url)).send().await {
                if response.status() == StatusCode::OK {
                    return;
                }
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
        panic!("trace-server did not become healthy");
    }
}

impl Drop for TestServer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_dir_all(&self.data_dir);
    }
}

fn unused_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("ephemeral port is available");
    listener
        .local_addr()
        .expect("local addr is available")
        .port()
}

async fn setup_admin(server: &TestServer, client: &Client) -> Value {
    let response = client
        .post(format!("{}/setup", server.base_url))
        .json(&json!({
            "workspace_name": "Trace API Test",
            "email": "admin@example.com",
            "password": "password123"
        }))
        .send()
        .await
        .expect("setup responds");
    assert_eq!(response.status(), StatusCode::CREATED);
    response.json::<Value>().await.expect("setup json")
}

async fn login(server: &TestServer, client: &Client) -> Value {
    let response = client
        .post(format!("{}/api/auth/login", server.base_url))
        .json(&json!({
            "email": "admin@example.com",
            "password": "password123"
        }))
        .send()
        .await
        .expect("login responds");
    assert_eq!(response.status(), StatusCode::OK);
    response.json::<Value>().await.expect("login json")
}

#[tokio::test]
async fn test_setup_flow() {
    let server = TestServer::start().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client builds");

    let status = client
        .get(format!("{}/api/setup/status", server.base_url))
        .send()
        .await
        .expect("status responds")
        .json::<Value>()
        .await
        .expect("status json");
    assert_eq!(status["setup_required"], true);

    let auth = setup_admin(&server, &client).await;
    assert!(auth["token"].as_str().is_some());
}

#[tokio::test]
async fn test_login_and_protected_routes() {
    let server = TestServer::start().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client builds");
    setup_admin(&server, &client).await;
    let auth = login(&server, &client).await;
    let token = auth["token"].as_str().expect("token exists");

    let notes = client
        .get(format!("{}/api/notes", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .expect("notes responds");
    assert_eq!(notes.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_backup_restore_roundtrip() {
    let server = TestServer::start().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client builds");
    let auth = setup_admin(&server, &client).await;
    let token = auth["token"].as_str().expect("token exists");

    let note = client
        .post(format!("{}/api/notes", server.base_url))
        .bearer_auth(token)
        .json(&json!({
            "title": "Before backup",
            "content": "[]",
            "tags": []
        }))
        .send()
        .await
        .expect("create note responds")
        .json::<Value>()
        .await
        .expect("note json");
    let note_id = note["id"].as_str().expect("note id");

    let backup = client
        .post(format!("{}/api/backup", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .expect("backup responds")
        .bytes()
        .await
        .expect("backup bytes");

    let updated = client
        .put(format!("{}/api/notes/{note_id}", server.base_url))
        .bearer_auth(token)
        .json(&json!({
            "title": "After backup",
            "content": "[]",
            "parentId": null,
            "tags": []
        }))
        .send()
        .await
        .expect("update responds");
    assert_eq!(updated.status(), StatusCode::OK);

    let restore = client
        .post(format!("{}/api/restore", server.base_url))
        .bearer_auth(token)
        .header("content-type", "application/zip")
        .body(backup)
        .send()
        .await
        .expect("restore responds");
    assert_eq!(restore.status(), StatusCode::OK);

    let restored = client
        .get(format!("{}/api/notes/{note_id}", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .expect("get restored responds")
        .json::<Value>()
        .await
        .expect("restored json");
    assert_eq!(restored["title"], "Before backup");
}

#[tokio::test]
async fn test_setup_returns_404_after_first_use() {
    let server = TestServer::start().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client builds");
    setup_admin(&server, &client).await;

    let setup_page = client
        .get(format!("{}/setup", server.base_url))
        .send()
        .await
        .expect("setup page responds");
    assert_eq!(setup_page.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_rate_limiting_on_login() {
    let server = TestServer::start().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client builds");
    setup_admin(&server, &client).await;

    for _ in 0..8 {
        let response = client
            .post(format!("{}/api/auth/login", server.base_url))
            .json(&json!({
                "email": "admin@example.com",
                "password": "wrong-password"
            }))
            .send()
            .await
            .expect("bad login responds");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    let limited = client
        .post(format!("{}/api/auth/login", server.base_url))
        .json(&json!({
            "email": "admin@example.com",
            "password": "wrong-password"
        }))
        .send()
        .await
        .expect("limited login responds");
    assert_eq!(limited.status(), StatusCode::TOO_MANY_REQUESTS);
}

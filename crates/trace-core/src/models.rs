use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeType {
    Workspace,
    Folder,
    Note,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub title: String,
    pub node_type: NodeType,
    pub parent_id: Option<String>,
    pub content: Option<String>,
    pub icon: Option<String>,
    pub tags: Vec<String>,
    pub position: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NoteRelation {
    pub source_id: String,
    pub target_id: String,
}

# Reverse proxy HTTPS

`trace-server` no termina TLS por si mismo. Para exponer Trace fuera de
localhost o de una LAN confiable, ponlo detras de un reverse proxy con HTTPS.

## Caddy

Ejemplo con Caddy:

```caddyfile
trace.example.com {
  reverse_proxy trace:8080
}
```

Con Docker Compose, el servicio `trace` puede mantenerse en la red interna y
Caddy publica solo `443`.

## Nginx

Ejemplo basico:

```nginx
server {
  listen 443 ssl http2;
  server_name trace.example.com;

  ssl_certificate /etc/letsencrypt/live/trace.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/trace.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

## Recomendaciones

- No publiques `8080` directamente a internet si no hay HTTPS delante.
- Usa una password admin larga y unica.
- Mantén backups fuera del mismo host cuando uses restore con datos importantes.
- Si usas Docker, deja `TRACE_BIND=0.0.0.0:8080` dentro del contenedor y publica
  solo el proxy.
- Si corres el binario directo en el host, prefiere
  `TRACE_BIND=127.0.0.1:8080` y deja que el proxy conecte localmente.

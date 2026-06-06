# Release process

Trace usa tags `v*` para publicar builds.

## Antes de crear un tag

1. Ejecutar:

```bash
npm run check
```

2. Confirmar que GitHub Actions este verde:

- `Build Linux Desktop`
- `Build Docker Image`
- `Security Audit`

3. Actualizar `CHANGELOG.md`.

## Crear version

```bash
git tag v0.2.0
git push origin v0.2.0
```

El workflow `Build Linux Desktop` crea un release draft y adjunta:

- `.deb`
- `.AppImage`
- `trace-server-linux-x86_64.tar.gz`
- `trace-server-linux-x86_64.tar.gz.sha256`

El workflow `Build Windows Desktop` adjunta al mismo release draft:

- `.msi`
- `-setup.exe`

El workflow `Publish Docker Image` publica:

- `ghcr.io/ricardoacuna007/trace-server:latest`
- `ghcr.io/ricardoacuna007/trace-server:v0.2.0`

## Publicar

1. Revisar el draft en GitHub Releases.
2. Descargar y probar los artefactos.
3. Completar notas de release usando `CHANGELOG.md`.
4. Publicar manualmente el release.

## Pendiente de release automation

- Firmar artefactos.

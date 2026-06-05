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

3. Actualizar `CHANGELOG.md`.

## Crear version

```bash
git tag v0.1.0
git push origin v0.1.0
```

El workflow `Build Linux Desktop` crea un release draft y adjunta:

- `.deb`
- `.AppImage`

El workflow `Publish Docker Image` publica:

- `ghcr.io/ricardoacuna007/trace-server:latest`
- `ghcr.io/ricardoacuna007/trace-server:v0.1.0`

## Publicar

1. Revisar el draft en GitHub Releases.
2. Descargar y probar los artefactos.
3. Completar notas de release usando `CHANGELOG.md`.
4. Publicar manualmente el release.

## Pendiente de release automation

- Adjuntar Windows MSI/NSIS.
- Adjuntar binario `trace-server` Linux.
- Firmar artefactos.

# Release process

Trace usa tags `v*` para publicar builds.

## Antes de crear un tag

1. Ejecutar:

```bash
npm run check
```

2. Confirmar que GitHub Actions este verde:

- `Build Linux Desktop`
- `Build Windows Desktop`
- `Build Docker Image`
- `Security Audit`

3. Completar el gate de QA de v0.3:

- Sugerencias inteligentes con vault real de 20-30 notas.
- Windows instalado limpio.
- Docker end-to-end con setup, notas, sugerencias, backup y restore.

Ver checklist completo en `docs/v0.3-release-qa.md`.

4. Actualizar `CHANGELOG.md`.

## Crear version

```bash
git tag v0.3.0
git push origin v0.3.0
```

El workflow `Build Linux Desktop` crea o actualiza el release y adjunta:

- `.deb`
- `.AppImage`
- `trace-server-linux-x86_64.tar.gz`
- `trace-server-linux-x86_64.tar.gz.sha256`

El workflow `Build Windows Desktop` adjunta al mismo release:

- `.msi`
- `-setup.exe`

El workflow `Publish Docker Image` publica:

- `ghcr.io/ricardoacuna007/trace-server:latest`
- `ghcr.io/ricardoacuna007/trace-server:v0.3.0`

## Publicar

1. Abrir GitHub Releases.
2. Descargar y probar los artefactos.
3. Si hay un problema, despublicar el release y corregir con un patch tag.
4. Completar o ajustar notas de release usando `CHANGELOG.md`.

## Pendiente de release automation

- Firmar artefactos.

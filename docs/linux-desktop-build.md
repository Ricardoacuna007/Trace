# Linux desktop build

Trace Desktop se distribuye en Linux como paquete Debian (`.deb`) y AppImage (`.AppImage`).

## Build local en Linux

Instala dependencias de sistema en Ubuntu/Debian:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libfuse2
```

Compila los bundles:

```bash
npm ci
npm run desktop:build:linux
```

Los artefactos se generan en:

```text
target/release/bundle/deb/
target/release/bundle/appimage/
```

## Build en GitHub Actions

El workflow `Build Linux Desktop` se ejecuta en `ubuntu-22.04` y produce un artefacto llamado `trace-linux-x86_64`.

Se dispara en:

- `push` a `main`
- `pull_request` contra `main`
- ejecución manual desde `Actions > Build Linux Desktop > Run workflow`
- tags `v*`, por ejemplo `v0.1.0`

Cuando el workflow corre sobre un tag `v*`, adjunta los bundles a un GitHub Release en modo draft.

## Instalar

Debian/Ubuntu:

```bash
sudo apt install ./Trace_*.deb
```

AppImage:

```bash
chmod +x Trace_*.AppImage
./Trace_*.AppImage
```

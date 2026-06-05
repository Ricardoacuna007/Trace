# Empezar con Trace

Trace se puede usar de tres formas. Elige la que encaje con tu caso y sigue los pasos.

## Desktop

Esta es la ruta recomendada si quieres usar Trace como app personal en tu computadora.

1. Descarga el instalador de Trace para tu sistema desde la pagina de releases del proyecto.
2. Instala la app.
3. Abre Trace.
4. Selecciona una carpeta para tu boveda local.
5. Empieza a crear notas.

Tus notas viven en tu equipo. Trace guarda la base local y los archivos de configuracion dentro de la carpeta de la boveda.

## Docker

Esta ruta es para tener Trace en un servidor propio y abrirlo desde el navegador.

1. Crea una carpeta nueva para Trace.
2. Dentro de esa carpeta, crea un archivo llamado `docker-compose.yml`.
3. Pega esta configuracion:

```yaml
services:
  trace:
    image: ghcr.io/ricardoacuna007/trace-server:latest
    ports:
      - "8080:8080"
    volumes:
      - trace_data:/data
    environment:
      - TRACE_BIND=0.0.0.0:8080
    restart: unless-stopped

volumes:
  trace_data:
```

4. Ejecuta:

```bash
docker compose up -d
```

5. Abre `http://localhost:8080`.
6. Crea el primer usuario administrador.

Despues del primer setup, la pantalla de setup deja de estar disponible.

## Binario Linux

Esta ruta es util si quieres ejecutar Trace en Linux sin Docker.

1. Descarga el binario `trace-server` desde releases.
2. Crea una carpeta para los datos:

```bash
mkdir -p ~/trace-data
```

3. Ejecuta el servidor:

```bash
TRACE_DATA_DIR=~/trace-data TRACE_BIND=0.0.0.0:8080 ./trace-server
```

4. Abre `http://localhost:8080`.
5. Crea el primer usuario administrador.

Para dejarlo corriendo siempre, puedes usar el administrador de servicios de tu sistema o Docker.

## Backups

En modo servidor, haz backups desde la seccion de datos antes de restaurar o actualizar versiones. Un backup contiene la base de datos del vault y se puede restaurar desde la misma UI.

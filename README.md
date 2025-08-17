# Exif Parser

## Goal of This Project

Read and parse EXIF (Exchangeable Image File Format) data from image files.
Works in both client and server environments.

## Pipeline

1. __Input to stream__
You pass `ArrayBuffer | Uint8Array | Buffer` into `createParser` → it wraps it in a `ByteStream` (safe, bounds-checked).
2. __JPEG scan check__
# Enei

## Goal of This Project

Reads and parses EXIF (Exchangeable Image File Format) data from image files.
Works in both client and server environments.

## Caveats

At this time, this package only supports reading EXIF data from JPEG files. 
It also only natively supports ESM. There are no plans to support CommonJS.

## Installation

```bash
pnpm add inei
```

## Usage

Using this package is simple. You can use it in both Node.js and browser environments.

```typescript
import { parseExif } from 'inei';

// First you'll need to load the image file as an ArrayBuffer.
// Assuming you have an image as a FileList:
const image = files[0]; 
const arrayBuffer = await image.arrayBuffer();

// Now you can parse the EXIF data from the ArrayBuffer.
const exifData = parseExif(arrayBuffer);

// It will return an object with two possible shapes:
{
    ok: true;
    data: ParsedExif;
} | {
    ok: false;
    error: ExifError;
}

// If the parsing was successful, you can access the EXIF data like this:
if (exifData.ok) {
    console.log(exifData.data);
} else {
    console.error('Error parsing EXIF data:', exifData.error);
}
```

## 

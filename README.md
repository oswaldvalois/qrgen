# QRGen — QR Code Generator

Web app QR code generator + scanner, plus aplikasi Android (APK).

**Live:** https://oswaldvalois.github.io/qrgen/

## Fitur

- Generate QR: Link, Teks, WiFi, vCard, Email, SMS, Lainnya (geo/telepon)
- Kustom: ukuran 256/512/1024, warna QR, warna latar, error correction L/M/Q/H
- Scan: kamera live + upload gambar
- Riwayat: localStorage, filter per tipe, download ulang, hapus
- Download PNG, dark mode, responsive
- Jalan 100% offline (semua asset lokal, termasuk font)

## Struktur

```
index.html                  halaman utama
css/style.css               styling (design system)
css/poppins.css             @font-face lokal
fonts/*.woff2               Poppins (12 file)
js/app.js                   generate + scan + riwayat + download
vendor/qrcode-generator.js  library generate QR
vendor/jsQR.js              library baca QR
download/                   APK Android yang di-serve ke publik
.nojekyll                   supaya GitHub Pages tidak proses lewat Jekyll
```

## Aplikasi Android

APK-nya ada di `download/QRGen-release-v1.2.1.apk` — versi Android dari web app ini,
dibungkus WebView, jalan 100% offline.

- targetSdk 36 (Android 16), minSdk 24 (Android 7.0)
- Ditandatangani release key
- Project APK: `~/qrgen-android` di laptop pengembang

## Development lokal

```
python3 -m http.server 8080
```

Terus buka http://127.0.0.1:8080

Catatan: scanner kamera butuh HTTPS atau localhost. Kalau diakses lewat
`http://<ip-lan>` (bukan localhost), browser blokir akses kamera — pakai
tombol "Upload Gambar QR" sebagai gantinya.

## Deploy

Repo ini di-serve langsung oleh GitHub Pages dari branch `main`, root folder.
Push ke `main` = langsung live dalam ~1 menit.

```
git add -A && git commit -m "update" && git push
```

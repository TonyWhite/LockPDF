# LockPDF
Simple PDF password manager

## How to launch
Simply double-click on **lockpdf**, or open shell and type `./lockpdf`

## How to use
Simply Drag & Drop file in window. Application recognizes automatically locked PDF and shows you only essential operations.

## Features
- Add password to open PDF
- Add password to edit PDF
- Remove password from PDF

## Info for advanced users
- Wrapper for qpdf
- Few dependencies to install (qpdf, gjs)
- Tested on Debian Stable: the non-latest versions is useful to cover
- Zenity is a weak dependence
- Launcher writed in bash script
- Core writed in GJS (Gnome JavaScript)
- Check dependencies directly from launcher
- Launcher can set broadway and light/dark default theme Adwaita
- Launcher can be edit to show message on close, editing `MESSAGE_ON_CLOSE=false` to `MESSAGE_ON_CLOSE=true`
- You can even launch application with `gjs main.js`

## Info for lamers
- This application is **not** intended to force PDF security

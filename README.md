<h1>Music Cards</h1>

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

A modern implementation of the classic **2048 game**, built with **React + TypeScript**.  
This version challenges you to go **beyond 2048 all the way to 65,536**,
<br/>
so the target board is:
</br>
![Full Board](public/fullBoard.png)</br>
Built with ❤️ by Tal and Inbar Segal. August 2025.

---

🎮 **Play it now in your browser:**  
👉 [2048 to 65k on GitHub Pages](https://talseg.github.io/react-2048/)

---

## 🎮 Features
- Supports Destop and phone browsers.
- Strives to exercise clean code principles:
  - Prefer readability over short or overly clever code.
  - Separate logic from UI for clarity and maintainability.
  - Keep developer tools clean — no warnings, no unnecessary logs or noise.
- Swipe support (keyboard and touch).
- Persistent board state, so you can continue where left off.
- Unlimited Undo system.
- Optional hints to help with strategy.
- **Storybook integration** for developing UI components in isolation.
- 100% open code for learning and contributions.

---

## 🚀 Getting Started



### Prerequisites
- You must have a paid [Spotify Premium Account](https://open.spotify.com/) 
- [git](https://git-scm.com/)
- [Node.js LTS](https://nodejs.org/)

### Spotify Dashboard definition
- Login to [Spotify developer Dashboard - https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
- Create a new Application
- In the Basic Information section generate a Client ID and a Client secret
- Under the src directory create a .env file with this format:
```bash
VITE_SPOTIFY_CLIENT_ID=<Your Client ID>
VITE_SPOTIFY_CLIENT_SECRET=<Your Client Secret>
```
- Add an App name and App description (anything you feel like)
- Add your i
- find out your ip address and ports to the Redirect URLs section 
- add https://\<your-ip-address\>:4173/callback
- add https://\<your-ip-address\>:5173/callback
</br>
- to find your ip address:
On PC open a terminal (Microsoft+r) and write cmd
</br>
in the terminal:
```bash
C:\>ipconfig | findstr IPv4
IPv4 Address. . . . . . . . . . . : <this-is-your-ip-address>
```
</br>

- (4173 is for running: npm run preview)
- (5173 is for running: npm run dev)
- Note:
- If reboot your computer abd get a different ip address - **you MUST add it** to the Urls in the dashboard this is a common pitfall.
- At the bottom Which API/SDKs are you planning to use:
- Check Web API and Web Playback SDK
- Check Web Playback SDK
- Don't forget to Save at the bottom
- Move to the User Management Tab
- Add you name and email
- If you have several members in you spotify account that want to run the app - add their names and emails also


### Installation
```bash
# Clone the repo
git clone https://github.com/talseg/music-cards.git
cd music-cards

# Install dependencies
npm install
```

### Run locally
```bash
npm run build
npm run preview
# or
npm run dev
```

for preview - Open http://<your-ip-address>:4173 in your browser.
for build - Open http://<your-ip-address>:5173 in your browser.

Note:
You **can not run** it from https://localhost:5173/ 
---

## 📜 License

This project is released under the [MIT License](./LICENSE)

- ✅ Free for personal use, learning, and contributions.  
- 🚫 Not allowed: publishing as an app on Google Play, Apple App Store, or similar platforms.  

---

## 🙏 Acknowledgments
- Built by Tal Segal using React and TypeScript.
- Built with [Vite](https://vitejs.dev/) and [Storybook](https://storybook.js.org/).
- Built using Anthropic Claude AI

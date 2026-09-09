# Universal Video Player Ad Defuser

A lightweight, high-performance userscript designed to neutralize in-stream video advertisements, pre-rolls, and mid-rolls across modern web players. 

Unlike traditional element-hiding extensions that cause video streams to buffer indefinitely or throw playback errors, this script intercepts requests at the network and prototype levels to bypass ad delivery mechanisms without stalling playback.

---

## Features

* **Multi-Network Protocol Interception:** Neutralizes outbound ad tags from Google IMA, DoubleClick, FreeWheel, SpotX, and standard VAST/VPAID servers by serving clean, empty `200 OK` manifests.
* **Stream Preservation:** Distinguishes between ad tracking calls and legitimate media transport chunks (`.m3u8`, `.mpd`, `.ts`, `.m4s`), preventing video player freezes and stutter.
* **SDK Compatibility Stubs:** Provides functional mock objects for `window.google.ima` to prevent anti-adblock detection scripts from throwing fatal exceptions.
* **Heuristic Ad Acceleration:** Identifies in-stream auxiliary ad video elements and auto-accelerates them (`16.0x` speed, muted, immediate seek-to-end).
* **Automated Skip Execution:** Continuously scans for interactive skip buttons across multiple languages and accessibility labels (`aria-label`) at an optimized 250ms polling interval.

---

## Installation

### Safari (iOS / iPadOS)
1. Install the **Userscripts** extension from the App Store.
2. Enable the extension in **Settings > Safari > Extensions**.
3. Open Safari, tap the **Userscripts** extension icon, and set your local directory inside the **Files** app.
4. Save the script file as `VideoPlayerAdDefuser.user.js` in that directory.
5. Ensure the script toggle is active.

### Firefox / Chrome / Edge (Desktop & Linux)
1. Install a userscript manager such as **Violentmonkey** or **Tampermonkey**.
2. Open the extension dashboard and click **Create a new script** (`+`).
3. Paste the contents of `VideoPlayerAdDefuser.user.js` and save (**Ctrl + S** / **Cmd + S**).

---

## How It Works

Modern video advertising relies on two primary channels: client-side SDK negotiation (such as Google IMA or FreeWheel) and video element swapping.

[Video Player Request]
                        |
             +----------+----------+
             |                     |
      (Ad Tag / VAST)   (Media Stream: .m3u8 / .ts)
             |                     |
    [Intercept & Serve]            |
    [  Empty VAST XML ]            |
             |                     v
             +-------------> [Video Element]
                                   |
                   (Is Duration <= 35s or Ad Wrapper?)
                                 /   \
                               YES    NO
                               /        \
                [Mute, 16x Speed,      [Normal Playback]
                   Seek to End]


1. **Network Interception:** Injected at `document-start`, the script proxies `window.fetch` and `XMLHttpRequest.prototype`. When an ad tag is requested, the script returns a synthetic `200 OK` response with empty VAST XML.
2. **Prototype Hooking:** Modifies `HTMLMediaElement.prototype.play` to inspect targets before playback starts.
3. **Timeline Fast-Forwarding:** If an ad segment bypasses network suppression, the script checks if the video is located within an ad wrapper or matches pre-roll length parameters (`duration <= 35s`), instantly jumping the timeline to the final frame.

---

## Configuration & Metadata

```javascript
// ==UserScript==
// @name         Universal Video Player Ad Defuser (Advanced Engine)
// @namespace    local.shield.videodefuser.adv
// @version      3.0.0
// @description  Intercepts VAST, FreeWheel, generic ad SDKs, and forces direct timeline seeking through unblockable pre-rolls.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

    @run-at document-start: Critical for hooking fetch, XMLHttpRequest, and global properties before host site scripts run.

    @grant none: Ensures execution occurs directly inside the host page's context without sandbox overhead or isolation boundaries.

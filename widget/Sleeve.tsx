import app from "ags/gtk4/app"
import { Gtk, Gdk } from "ags/gtk4"
import { createBinding } from "ags"
import { createPoll } from "ags/time"
import Mpris from "gi://AstalMpris"
import GLib from "gi://GLib"
import { getCacheKey, getCachedArtwork, fetchHighResArtwork } from "./artwork"

const mpris = Mpris.get_default()
const SIZES = { small: 150, medium: 200, large: 300 }
const SIZE_ORDER: Array<keyof typeof SIZES> = ["small", "medium", "large"]
const MINI_HEIGHT = 40  // 20% of full size
const MARQUEE_WIDTH = 26

// Get window info including position, size, and which corner to anchor
function getWindowInfo(): { x: number; y: number; w: number; h: number; anchorRight: boolean; anchorBottom: boolean } | null {
  try {
    // Get window info
    const [, windowOut] = GLib.spawn_command_line_sync("hyprctl clients -j")
    const clients = JSON.parse(new TextDecoder().decode(windowOut))
    const sleevie = clients.find((c: any) => c.class === "io.Astal.sleevie")

    if (!sleevie) return null

    const [winX, winY] = sleevie.at
    const [winW, winH] = sleevie.size

    // Get monitor info
    const [, monitorOut] = GLib.spawn_command_line_sync("hyprctl monitors -j")
    const monitors = JSON.parse(new TextDecoder().decode(monitorOut))

    // Find the monitor containing the window
    const monitor = monitors.find((m: any) => {
      const mx = m.x, my = m.y, mw = m.width, mh = m.height
      return winX >= mx && winX < mx + mw && winY >= my && winY < my + mh
    }) || monitors[0]

    // Calculate window center relative to monitor
    const winCenterX = winX + winW / 2 - monitor.x
    const winCenterY = winY + winH / 2 - monitor.y
    const monCenterX = monitor.width / 2
    const monCenterY = monitor.height / 2

    return {
      x: winX,
      y: winY,
      w: winW,
      h: winH,
      anchorRight: winCenterX > monCenterX,
      anchorBottom: winCenterY > monCenterY
    }
  } catch {
    return null
  }
}

// Calculate target position to keep anchor corner in place after resize
function calcAnchoredPosition(
  oldX: number, oldY: number, oldW: number, oldH: number,
  newW: number, newH: number,
  anchorRight: boolean, anchorBottom: boolean
): { x: number; y: number } {
  // Calculate where anchor corner currently is
  const anchorX = anchorRight ? oldX + oldW : oldX
  const anchorY = anchorBottom ? oldY + oldH : oldY

  // Calculate new position to keep anchor corner in place
  const newX = anchorRight ? anchorX - newW : anchorX
  const newY = anchorBottom ? anchorY - newH : anchorY

  return { x: newX, y: newY }
}

export default function Sleeve(gdkmonitor: Gdk.Monitor) {
  let isMinimized = false
  let currentSize: keyof typeof SIZES = "medium"
  let currentArt = ""
  let lastTrackKey = ""

  const players = createBinding(mpris, "players")
  const firstPlayer = () => mpris.get_players()[0]

  // Callback to update artwork when high-res version is found
  const updateArtwork = (path: string) => {
    currentArt = `file://${path}`
  }

  const coverArt = createPoll("", 1000, () => {
    const player = mpris.get_players()[0]
    if (!player) return ""

    const artist = player.artist || ""
    const album = player.album || ""
    const trackKey = getCacheKey(artist, album)

    // Track changed - try to fetch high-res
    if (trackKey !== lastTrackKey && artist && album) {
      lastTrackKey = trackKey

      // Check cache first
      const cached = getCachedArtwork(artist, album)
      if (cached) {
        currentArt = `file://${cached}`
      } else {
        // Start with MPRIS art, fetch high-res in background
        const mprisArt = player.coverArt
        if (mprisArt) {
          currentArt = mprisArt.startsWith("/") ? `file://${mprisArt}` : mprisArt
        }
        // Fetch high-res in background
        fetchHighResArtwork(artist, album, updateArtwork)
      }
    }

    // Return current art (may be updated by callback)
    if (currentArt) return currentArt

    // Fallback to MPRIS art
    const art = player.coverArt
    if (!art) return ""
    if (art.startsWith("/")) return `file://${art}`
    return art
  })

  const isPlaying = createPoll(false, 500, () => {
    const p = mpris.get_players()[0]
    return p?.playbackStatus === Mpris.PlaybackStatus.PLAYING
  })

  const hasPlayer = players((list) => list.length > 0)

  let scrollPos = 0
  const marqueeText = createPoll("", 250, () => {
    const t = mpris.get_players()[0]?.title || ""
    const a = mpris.get_players()[0]?.artist || ""
    const full = a ? `${t} - ${a}` : t
    if (full.length <= MARQUEE_WIDTH) return full

    const padded = full + "   ●   "
    scrollPos = (scrollPos + 1) % padded.length
    return padded.slice(scrollPos) + padded.slice(0, scrollPos)
  })

  // Create window
  const win = new Gtk.Window({
    title: "sleevie",
    name: "sleevie",
    decorated: false,
    resizable: false,
    application: app,
  })
  win.add_css_class("Sleeve")

  // Helper to get current art size
  const getArtSize = () => SIZES[currentSize]

  // Main container - we'll resize this
  const container = new Gtk.Overlay()
  container.add_css_class("sleevie-container")
  container.set_size_request(SIZES.medium, SIZES.medium)

  // Album art box (base layer) - use JSX for css binding to work
  const artBox = (
    <box
      class="album-art"
      widthRequest={SIZES.medium}
      heightRequest={SIZES.medium}
      css={coverArt((art) => art ? `background-image: url("${art}");` : "")}
    />
  ) as Gtk.Box

  container.set_child(artBox)

  // Normal mode hover overlay
  const hoverOverlay = (
    <box
      class="hover-overlay"
      widthRequest={SIZES.medium}
      heightRequest={SIZES.medium}
      halign={Gtk.Align.FILL}
      valign={Gtk.Align.FILL}
      orientation={Gtk.Orientation.VERTICAL}
    >
      {/* Top row with minimize (left) and size toggle (right) */}
      <box halign={Gtk.Align.FILL}>
        <button class="window-btn" onClicked={() => toggle()}>
          <image iconName="window-minimize-symbolic" />
        </button>
        <box hexpand />
        <button class="window-btn" onClicked={() => cycleSize()}>
          <image iconName="view-fullscreen-symbolic" />
        </button>
      </box>
      <box vexpand />
      <box
        class="controls"
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        spacing={8}
        visible={hasPlayer}
      >
        <button class="control-btn" onClicked={() => firstPlayer()?.previous()}>
          <image iconName="media-skip-backward-symbolic" />
        </button>
        <button class="control-btn play-btn" onClicked={() => firstPlayer()?.play_pause()}>
          <image iconName={isPlaying((p) => p ? "media-playback-pause-symbolic" : "media-playback-start-symbolic")} />
        </button>
        <button class="control-btn" onClicked={() => firstPlayer()?.next()}>
          <image iconName="media-skip-forward-symbolic" />
        </button>
      </box>
      <box vexpand />
    </box>
  ) as Gtk.Widget

  // Track info overlay (normal mode)
  const trackOverlay = (
    <box
      class="track-info-overlay"
      valign={Gtk.Align.END}
      halign={Gtk.Align.FILL}
    >
      <box class="track-info" visible={hasPlayer} halign={Gtk.Align.START}>
        <label
          class="track-title marquee"
          label={marqueeText}
          maxWidthChars={MARQUEE_WIDTH}
          xalign={0}
        />
      </box>
    </box>
  ) as Gtk.Widget

  // Mini mode content (always visible text)
  const miniContent = (
    <box
      class="mini-content"
      widthRequest={SIZES.medium}
      heightRequest={MINI_HEIGHT}
      halign={Gtk.Align.FILL}
      valign={Gtk.Align.FILL}
    >
      <box class="mini-text" halign={Gtk.Align.START} valign={Gtk.Align.CENTER} hexpand>
        <label
          class="track-title marquee"
          label={marqueeText}
          maxWidthChars={20}
          xalign={0}
        />
      </box>
    </box>
  ) as Gtk.Widget
  miniContent.set_visible(false)

  // Mini mode hover overlay
  const miniHoverOverlay = (
    <box
      class="mini-hover-overlay"
      widthRequest={SIZES.medium}
      heightRequest={MINI_HEIGHT}
      halign={Gtk.Align.FILL}
      valign={Gtk.Align.FILL}
    >
      {/* Unminimize button on left */}
      <box valign={Gtk.Align.CENTER} halign={Gtk.Align.START}>
        <button class="window-btn" onClicked={() => toggle()}>
          <image iconName="window-maximize-symbolic" />
        </button>
      </box>
      {/* Controls on right */}
      <box
        class="mini-controls"
        halign={Gtk.Align.END}
        valign={Gtk.Align.CENTER}
        spacing={4}
        visible={hasPlayer}
        hexpand
      >
        <button class="control-btn" onClicked={() => firstPlayer()?.previous()}>
          <image iconName="media-skip-backward-symbolic" />
        </button>
        <button class="control-btn play-btn" onClicked={() => firstPlayer()?.play_pause()}>
          <image iconName={isPlaying((p) => p ? "media-playback-pause-symbolic" : "media-playback-start-symbolic")} />
        </button>
        <button class="control-btn" onClicked={() => firstPlayer()?.next()}>
          <image iconName="media-skip-forward-symbolic" />
        </button>
      </box>
    </box>
  ) as Gtk.Widget
  miniHoverOverlay.set_visible(false)

  // Add overlays
  container.add_overlay(hoverOverlay)
  container.add_overlay(trackOverlay)
  container.add_overlay(miniContent)
  container.add_overlay(miniHoverOverlay)

  // Cycle through sizes
  const cycleSize = () => {
    if (isMinimized) return  // Don't resize while minimized

    // Get window info before resize
    const infoBefore = getWindowInfo()
    if (!infoBefore) return

    const currentIndex = SIZE_ORDER.indexOf(currentSize)
    const nextIndex = (currentIndex + 1) % SIZE_ORDER.length
    const newSizeName = SIZE_ORDER[nextIndex]
    const newSize = SIZES[newSizeName]
    currentSize = newSizeName

    // Resize first
    container.set_size_request(newSize, newSize)
    ;(artBox as Gtk.Widget).set_size_request(newSize, newSize)
    hoverOverlay.set_size_request(newSize, newSize)
    trackOverlay.set_size_request(newSize, -1)
    miniContent.set_size_request(newSize, MINI_HEIGHT)
    miniHoverOverlay.set_size_request(newSize, MINI_HEIGHT)

    // After delay, get actual size and calculate correct position
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      const infoAfter = getWindowInfo()
      if (!infoAfter) return false

      // Use actual size after resize (in case of minimum size constraints)
      const target = calcAnchoredPosition(
        infoBefore.x, infoBefore.y, infoBefore.w, infoBefore.h,
        infoAfter.w, infoAfter.h,
        infoBefore.anchorRight, infoBefore.anchorBottom
      )

      GLib.spawn_command_line_async(
        `hyprctl dispatch movewindowpixel exact ${target.x} ${target.y},class:io.Astal.sleevie`
      )
      return false
    })
  }

  // Toggle function
  const toggle = () => {
    // Get window info before resize
    const infoBefore = getWindowInfo()
    if (!infoBefore) return

    isMinimized = !isMinimized
    const artSize = getArtSize()
    const newHeight = isMinimized ? MINI_HEIGHT : artSize

    // Resize first
    container.set_size_request(artSize, newHeight)
    ;(artBox as Gtk.Widget).set_size_request(artSize, newHeight)

    // Toggle CSS classes
    if (isMinimized) {
      container.add_css_class("mini")
      ;(artBox as Gtk.Widget).add_css_class("mini-art")
    } else {
      container.remove_css_class("mini")
      ;(artBox as Gtk.Widget).remove_css_class("mini-art")
    }

    // Toggle visibility
    hoverOverlay.set_visible(!isMinimized)
    trackOverlay.set_visible(!isMinimized)
    miniContent.set_visible(isMinimized)
    miniHoverOverlay.set_visible(isMinimized)

    // After delay, get actual size and calculate correct position
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      const infoAfter = getWindowInfo()
      if (!infoAfter) return false

      // Use actual size after resize (in case of minimum size constraints)
      const target = calcAnchoredPosition(
        infoBefore.x, infoBefore.y, infoBefore.w, infoBefore.h,
        infoAfter.w, infoAfter.h,
        infoBefore.anchorRight, infoBefore.anchorBottom
      )

      GLib.spawn_command_line_async(
        `hyprctl dispatch movewindowpixel exact ${target.x} ${target.y},class:io.Astal.sleevie`
      )
      return false
    })
  }

  win.set_child(container)
  win.present()

  return win
}

import app from "ags/gtk4/app"
import { Gtk, Gdk } from "ags/gtk4"
import { createBinding } from "ags"
import { createPoll } from "ags/time"
import Mpris from "gi://AstalMpris"
import GObject from "gi://GObject"
import GLib from "gi://GLib"

const mpris = Mpris.get_default()
const ART_SIZE = 200
const MINI_HEIGHT = 40  // 20% of full size
const MARQUEE_WIDTH = 26

export default function Sleeve(gdkmonitor: Gdk.Monitor) {
  let isMinimized = false

  const players = createBinding(mpris, "players")
  const firstPlayer = () => mpris.get_players()[0]

  const coverArt = createPoll("", 1000, () => {
    const art = mpris.get_players()[0]?.coverArt
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
    name: "sleeve",
    decorated: false,
    resizable: false,
    application: app,
  })
  win.add_css_class("Sleeve")

  // Main container - we'll resize this
  const container = new Gtk.Overlay()
  container.add_css_class("sleeve-container")
  container.set_size_request(ART_SIZE, ART_SIZE)

  // Album art box (base layer) - use JSX for css binding to work
  const artBox = (
    <box
      class="album-art"
      widthRequest={ART_SIZE}
      heightRequest={ART_SIZE}
      css={coverArt((art) => art ? `background-image: url("${art}");` : "")}
    />
  ) as Gtk.Box

  container.set_child(artBox)

  // Normal mode hover overlay
  const hoverOverlay = (
    <box
      class="hover-overlay"
      widthRequest={ART_SIZE}
      heightRequest={ART_SIZE}
      halign={Gtk.Align.FILL}
      valign={Gtk.Align.FILL}
    >
      <box valign={Gtk.Align.START} halign={Gtk.Align.END}>
        <button class="window-btn" onClicked={() => toggle()}>
          <label label="─" />
        </button>
      </box>
      <box vexpand />
      <box
        class="controls"
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        spacing={8}
        visible={hasPlayer}
        vexpand
      >
        <button class="control-btn" onClicked={() => firstPlayer()?.previous()}>
          <label label="◀◀" />
        </button>
        <button class="control-btn play-btn" onClicked={() => firstPlayer()?.play_pause()}>
          <label label={isPlaying((p) => p ? "❚❚" : "▶")} />
        </button>
        <button class="control-btn" onClicked={() => firstPlayer()?.next()}>
          <label label="▶▶" />
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
      widthRequest={ART_SIZE}
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
      widthRequest={ART_SIZE}
      heightRequest={MINI_HEIGHT}
      halign={Gtk.Align.FILL}
      valign={Gtk.Align.FILL}
    >
      <box
        class="mini-controls"
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        spacing={4}
        visible={hasPlayer}
      >
        <button class="control-btn" onClicked={() => firstPlayer()?.previous()}>
          <label label="◀◀" />
        </button>
        <button class="control-btn play-btn" onClicked={() => firstPlayer()?.play_pause()}>
          <label label={isPlaying((p) => p ? "❚❚" : "▶")} />
        </button>
        <button class="control-btn" onClicked={() => firstPlayer()?.next()}>
          <label label="▶▶" />
        </button>
      </box>
      <box valign={Gtk.Align.CENTER} halign={Gtk.Align.END}>
        <button class="window-btn" onClicked={() => toggle()}>
          <label label="□" />
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

  // Toggle function
  const toggle = () => {
    isMinimized = !isMinimized
    const newHeight = isMinimized ? MINI_HEIGHT : ART_SIZE
    const heightDiff = ART_SIZE - MINI_HEIGHT

    // Resize container and art
    container.set_size_request(ART_SIZE, newHeight)
    ;(artBox as Gtk.Widget).set_size_request(ART_SIZE, newHeight)

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

    // Hyprland centers the resize, so we only need to move by half the height difference
    const moveY = isMinimized ? (heightDiff / 2) : -(heightDiff / 2)
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
      GLib.spawn_command_line_async(
        `hyprctl dispatch movewindowpixel 0 ${moveY},class:io.Astal.sleeve`
      )
      return false
    })
  }

  win.set_child(container)
  win.present()

  return win
}

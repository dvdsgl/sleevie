import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createBinding } from "ags"
import Mpris from "gi://AstalMpris"

const mpris = Mpris.get_default()
const ART_SIZE = 180

export default function Sleeve(gdkmonitor: Gdk.Monitor) {
  const players = createBinding(mpris, "players")
  const { BOTTOM, LEFT } = Astal.WindowAnchor

  // Derive bindings from first player when available
  const firstPlayer = () => mpris.get_players()[0]

  const title = players((list) => list[0]?.title || "Nothing playing")
  const artist = players((list) => list[0]?.artist || "")
  const coverArt = players((list) => {
    const art = list[0]?.coverArt
    if (!art) return ""
    // Ensure file:// prefix for local paths
    if (art.startsWith("/")) return `file://${art}`
    return art
  })
  const isPlaying = players((list) =>
    list[0]?.playbackStatus === Mpris.PlaybackStatus.PLAYING
  )
  const hasPlayer = players((list) => list.length > 0)

  return (
    <window
      visible
      name="sleeve"
      class="Sleeve"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={BOTTOM | LEFT}
      marginBottom={20}
      marginLeft={20}
      application={app}
      layer={Astal.Layer.TOP}
    >
      <box class="sleeve-container" orientation={Gtk.Orientation.VERTICAL} widthRequest={ART_SIZE}>
        {/* Album Art */}
        <box
          class="album-art"
          widthRequest={ART_SIZE}
          heightRequest={ART_SIZE}
          css={coverArt((art) => art ? `background-image: url("${art}");` : "")}
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.CENTER}
        >
          <label
            class="placeholder-icon"
            label="♪"
            visible={coverArt((art) => !art)}
          />
        </box>

        {/* Track info */}
        <box class="track-info" orientation={Gtk.Orientation.VERTICAL} visible={hasPlayer}>
          <label
            class="track-title"
            label={title}
            ellipsize={3}
            maxWidthChars={20}
            xalign={0}
          />
          <label
            class="track-artist"
            label={artist}
            ellipsize={3}
            maxWidthChars={20}
            xalign={0}
            visible={artist((a) => !!a)}
          />
        </box>

        {/* Controls */}
        <box class="controls" halign={Gtk.Align.CENTER} spacing={8} visible={hasPlayer}>
          <button class="control-btn" onClicked={() => firstPlayer()?.previous()}>
            <label label="⏮" />
          </button>
          <button class="control-btn play-btn" onClicked={() => firstPlayer()?.play_pause()}>
            <label label={isPlaying((p) => p ? "⏸" : "▶")} />
          </button>
          <button class="control-btn" onClicked={() => firstPlayer()?.next()}>
            <label label="⏭" />
          </button>
        </box>
      </box>
    </window>
  )
}

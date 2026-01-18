import app from "ags/gtk4/app"
import style from "./style.scss"
import Sleeve from "./widget/Sleeve"

app.start({
  css: style,
  instanceName: "sleevie",
  main() {
    // Only show on primary monitor
    const monitors = app.get_monitors()
    if (monitors.length > 0) {
      Sleeve(monitors[0])
    }
  },
})

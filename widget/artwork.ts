import GLib from "gi://GLib"
import Gio from "gi://Gio"
import Soup from "gi://Soup?version=3.0"

const CACHE_DIR = `${GLib.get_user_cache_dir()}/sleevie`

// Ensure cache directory exists
GLib.mkdir_with_parents(CACHE_DIR, 0o755)

// HTTP session for fetching artwork
const session = new Soup.Session()

// Cache for high-res artwork: "artist-album" -> local file path
const artworkCache = new Map<string, string>()

// Currently loading artwork key to avoid duplicate requests
let loadingArtwork: string | null = null

// Get cache key for artist/album
export function getCacheKey(artist: string, album: string): string {
  return `${artist}-${album}`.replace(/[^a-zA-Z0-9-]/g, "_").toLowerCase()
}

// Get cached artwork path if available
export function getCachedArtwork(artist: string, album: string): string | null {
  const cacheKey = getCacheKey(artist, album)
  return artworkCache.get(cacheKey) || null
}

// Search iTunes for high-res artwork
export function fetchHighResArtwork(
  artist: string,
  album: string,
  onFound: (path: string) => void
): void {
  const cacheKey = getCacheKey(artist, album)

  // Already cached in memory?
  if (artworkCache.has(cacheKey)) {
    onFound(artworkCache.get(cacheKey)!)
    return
  }

  // Already loading this one?
  if (loadingArtwork === cacheKey) return
  loadingArtwork = cacheKey

  const localPath = `${CACHE_DIR}/${cacheKey}.jpg`

  // Check if already downloaded to disk
  if (GLib.file_test(localPath, GLib.FileTest.EXISTS)) {
    artworkCache.set(cacheKey, localPath)
    loadingArtwork = null
    onFound(localPath)
    return
  }

  // Search iTunes
  const searchTerm = encodeURIComponent(`${artist} ${album}`)
  const searchUrl = `https://itunes.apple.com/search?term=${searchTerm}&entity=album&limit=1`

  const message = Soup.Message.new("GET", searchUrl)
  if (!message) {
    loadingArtwork = null
    return
  }

  session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (_, result) => {
    try {
      const bytes = session.send_and_read_finish(result)
      if (!bytes) {
        loadingArtwork = null
        return
      }

      const data = new TextDecoder().decode(bytes.get_data()!)
      const json = JSON.parse(data)

      if (json.resultCount > 0) {
        // Get artwork URL and request higher resolution (600x600)
        let artworkUrl = json.results[0].artworkUrl100
        artworkUrl = artworkUrl.replace("100x100", "600x600")

        // Download the image
        downloadImage(artworkUrl, localPath, cacheKey, onFound)
      } else {
        loadingArtwork = null
      }
    } catch (e) {
      loadingArtwork = null
    }
  })
}

// Download image to local cache
function downloadImage(
  url: string,
  localPath: string,
  cacheKey: string,
  onFound: (path: string) => void
): void {
  const imgMessage = Soup.Message.new("GET", url)
  if (!imgMessage) {
    loadingArtwork = null
    return
  }

  session.send_and_read_async(imgMessage, GLib.PRIORITY_DEFAULT, null, (_, imgResult) => {
    try {
      const imgBytes = session.send_and_read_finish(imgResult)
      if (!imgBytes) {
        loadingArtwork = null
        return
      }

      // Save to cache
      const file = Gio.File.new_for_path(localPath)
      const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null)
      stream.write_bytes(imgBytes, null)
      stream.close(null)

      artworkCache.set(cacheKey, localPath)
      loadingArtwork = null
      onFound(localPath)
    } catch (e) {
      loadingArtwork = null
    }
  })
}

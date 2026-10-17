// Flashback lobby OST — SongWalker logical playlist (design example).
// Runtime today: lobby.playlist.json + LobbyPlaylist.js / FlashbackLobbyPlaylist.kt
// Future: SongWalker RealtimeSession with host-fed state.

const fadeMs = 800
const vol = 0.28

// Nested "songs" are endless shuffled playlists of Bunny URLs (filled at publish).
loadSong("publicDomain", "https://flashbackrepository.b-cdn.net/lobby/public-domain/")
loadSong("winter", "https://flashbackrepository.b-cdn.net/lobby/christmas/")

when state.theater == true || state.enabled == false -> fadeOut(fadeMs)
when state.enabled == true && state.theater == false && state.season == "winter" -> playSong("winter")
when state.enabled == true && state.theater == false -> playSong("publicDomain")

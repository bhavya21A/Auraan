export const songs = [
  {
    id: 'song-1',
    title: 'Midnight Bloom',
    artist: 'Astra Bloom',
    album: 'Velvet Horizon',
    duration: '3:24',
    durationSeconds: 204,
    accent: 'from-pink-500 via-rose-500 to-orange-400',
    cover: 'from-pink-500 via-fuchsia-500 to-amber-400',
    mood: 'Night drive',
  },
  {
    id: 'song-2',
    title: 'Afterglow Avenue',
    artist: 'North Harbor',
    album: 'Coastal Static',
    duration: '4:12',
    durationSeconds: 252,
    accent: 'from-cyan-500 via-blue-500 to-indigo-600',
    cover: 'from-cyan-500 via-blue-500 to-violet-600',
    mood: 'Sunset',
  },
  {
    id: 'song-3',
    title: 'Glass Hearts',
    artist: 'Luna Vale',
    album: 'Opal Echo',
    duration: '3:48',
    durationSeconds: 228,
    accent: 'from-violet-500 via-purple-500 to-pink-500',
    cover: 'from-violet-600 via-purple-500 to-pink-500',
    mood: 'Dream pop',
  },
  {
    id: 'song-4',
    title: 'Signal in the Rain',
    artist: 'Echo Harbor',
    album: 'Static Sky',
    duration: '4:31',
    durationSeconds: 271,
    accent: 'from-sky-500 via-cyan-500 to-teal-400',
    cover: 'from-sky-500 via-cyan-500 to-teal-500',
    mood: 'Focus',
  },
  {
    id: 'song-5',
    title: 'Paper Moon Motel',
    artist: 'Juniper Lane',
    album: 'Soft Static',
    duration: '3:09',
    durationSeconds: 189,
    accent: 'from-amber-400 via-orange-500 to-rose-500',
    cover: 'from-amber-400 via-orange-500 to-red-500',
    mood: 'Road trip',
  },
  {
    id: 'song-6',
    title: 'Low Tide City',
    artist: 'Mara North',
    album: 'Antenna Bloom',
    duration: '5:02',
    durationSeconds: 302,
    accent: 'from-emerald-500 via-teal-500 to-cyan-400',
    cover: 'from-emerald-500 via-cyan-500 to-blue-500',
    mood: 'Late evening',
  },
]

export const artists = [
  { id: 'artist-1', name: 'Astra Bloom', genre: 'Synthwave', followers: '1.8M', accent: 'from-pink-500 to-orange-400' },
  { id: 'artist-2', name: 'North Harbor', genre: 'Indie pop', followers: '930K', accent: 'from-cyan-500 to-indigo-600' },
  { id: 'artist-3', name: 'Luna Vale', genre: 'Soul', followers: '2.4M', accent: 'from-violet-500 to-pink-500' },
  { id: 'artist-4', name: 'Echo Harbor', genre: 'Electronic', followers: '1.1M', accent: 'from-sky-500 to-teal-500' },
  { id: 'artist-5', name: 'Juniper Lane', genre: 'Alt-rock', followers: '740K', accent: 'from-amber-400 to-rose-500' },
]

export const albums = [
  { id: 'album-1', title: 'Velvet Horizon', artist: 'Astra Bloom', year: '2025', songs: 12, duration: '44 min', accent: 'from-pink-500 via-rose-500 to-orange-400' },
  { id: 'album-2', title: 'Coastal Static', artist: 'North Harbor', year: '2024', songs: 10, duration: '37 min', accent: 'from-cyan-500 via-blue-500 to-indigo-600' },
  { id: 'album-3', title: 'Opal Echo', artist: 'Luna Vale', year: '2023', songs: 9, duration: '31 min', accent: 'from-violet-500 via-purple-500 to-pink-500' },
  { id: 'album-4', title: 'Static Sky', artist: 'Echo Harbor', year: '2025', songs: 13, duration: '46 min', accent: 'from-sky-500 via-teal-500 to-cyan-400' },
  { id: 'album-5', title: 'Soft Static', artist: 'Juniper Lane', year: '2022', songs: 11, duration: '39 min', accent: 'from-amber-400 via-orange-500 to-red-500' },
]

export const playlists = [
  { id: 'playlist-1', title: 'Daily Mix', description: 'Curated for your evening mood.', creator: 'Milo', totalSongs: 26, length: '1h 48m', accent: 'from-pink-500 via-red-500 to-orange-400' },
  { id: 'playlist-2', title: 'Focus Flow', description: 'Deep work, calm signals, and clean rhythm.', creator: 'Rae', totalSongs: 32, length: '2h 18m', accent: 'from-indigo-500 via-violet-500 to-cyan-400' },
  { id: 'playlist-3', title: 'Chill Session', description: 'Late-night electronic and warm analog textures.', creator: 'Nova', totalSongs: 21, length: '1h 26m', accent: 'from-sky-500 via-blue-500 to-indigo-500' },
  { id: 'playlist-4', title: 'Favorites Mix', description: 'Songs you keep coming back to.', creator: 'You', totalSongs: 18, length: '1h 12m', accent: 'from-amber-400 via-orange-500 to-rose-500' },
]

export const genres = [
  { id: 'genre-1', title: 'Pop', caption: 'Bright hooks', accent: 'from-pink-500 via-rose-500 to-orange-400' },
  { id: 'genre-2', title: 'Hip-Hop', caption: 'Pulse & bounce', accent: 'from-violet-500 via-purple-500 to-fuchsia-500' },
  { id: 'genre-3', title: 'Electronic', caption: 'Night drive', accent: 'from-cyan-500 via-blue-500 to-indigo-600' },
  { id: 'genre-4', title: 'Rock', caption: 'Raw energy', accent: 'from-orange-500 via-red-500 to-rose-600' },
  { id: 'genre-5', title: 'R&B', caption: 'Soft focus', accent: 'from-fuchsia-500 via-rose-500 to-violet-500' },
  { id: 'genre-6', title: 'Classical', caption: 'Grand atmospheres', accent: 'from-sky-500 via-cyan-500 to-emerald-400' },
  { id: 'genre-7', title: 'Indie', caption: 'Human textures', accent: 'from-amber-400 via-yellow-500 to-orange-500' },
  { id: 'genre-8', title: 'Lo-Fi', caption: 'Focus & drift', accent: 'from-stone-500 via-slate-500 to-zinc-700' },
]

export const moods = [
  { id: 'mood-1', title: 'Focus', accent: 'from-sky-500 to-indigo-500' },
  { id: 'mood-2', title: 'Workout', accent: 'from-red-500 to-orange-500' },
  { id: 'mood-3', title: 'Sleep', accent: 'from-violet-500 to-indigo-600' },
  { id: 'mood-4', title: 'Party', accent: 'from-pink-500 to-rose-500' },
  { id: 'mood-5', title: 'Chill', accent: 'from-emerald-500 to-cyan-500' },
  { id: 'mood-6', title: 'Driving', accent: 'from-amber-500 to-orange-500' },
  { id: 'mood-7', title: 'Study', accent: 'from-cyan-500 to-sky-500' },
]

export const radioStations = [
  { id: 'radio-1', title: 'Neon Nights', host: 'Astra Bloom', listeners: '24K', accent: 'from-pink-500 via-fuchsia-500 to-orange-400' },
  { id: 'radio-2', title: 'Sunset Drive', host: 'North Harbor', listeners: '18K', accent: 'from-cyan-500 via-blue-500 to-indigo-600' },
  { id: 'radio-3', title: 'Indigo Depths', host: 'Luna Vale', listeners: '16K', accent: 'from-violet-500 via-purple-500 to-pink-500' },
  { id: 'radio-4', title: 'Night Shift', host: 'Echo Harbor', listeners: '12K', accent: 'from-sky-500 via-teal-500 to-cyan-400' },
]

export const recentSearches = ['Astra Bloom', 'Late Night', 'Indie pop', 'Focus flow', 'Neon beats']
export const suggestedSearches = ['New releases', 'Mellow house', 'Alternative', 'Summer drive', 'Afterhours']

export const queue = [
  songs[0],
  songs[1],
  songs[2],
  songs[3],
  songs[4],
  songs[5],
]

export const lyrics = `
[Verse 1]
Streetlights hum like a secret tune
Pale neon spilling through the room
Your shadow moves in the midnight blue
Calling me in a language only we knew

[Pre-Chorus]
We were chasing sparks in the rain
Making little miracles out of pain

[Chorus]
Oh, midnight bloom
Turn the tide, turn me to you
Bloom like a fever in the moon
And the whole night glows when you move
`
// The characters, their display names and the colors each wears when the user has not chosen any.
// `body` is the main color (the cloud, the fox, the slime...); `accent` is the secondary one (headphones, hat,
// scarf, hair, cheeks...). Details with a fixed look (gold, goggles, screens, books) do not change.
export const CHARACTER_DEFAULTS = Object.freeze({
  alpha: { body: '#78c2ff', accent: '#ff9ec0' },
  classic: { body: '#cab4e9', accent: '#372d70' },
  fox: { body: '#e98658', accent: '#382955' },
  bot: { body: '#c9bbdb', accent: '#3164b4' },
  slime: { body: '#477cd3', accent: '#6a5bd8' },
  mage: { body: '#b861ac', accent: '#522795' },
  aquatic: { body: '#cebcf0', accent: '#341428' },
  claude: { body: '#d97757', accent: '#c4633f' },
})

export const CHARACTER_NAMES = Object.freeze({
  alpha: 'Alpha', classic: 'Classic', fox: 'Foxy', bot: 'Bot', slime: 'Slime', mage: 'Mage', aquatic: 'Penny', claude: 'Claude',
})

export const CHARACTER_BLURBS = Object.freeze({
  alpha: 'The original CodePuff: a round, soft puff with a sprout and an alpha mark.',
  classic: 'A fluffy code cloud with headphones and a curl on top.',
  fox: 'A curious explorer fox with goggles and a code scarf.',
  bot: 'A tidy little robot with a screen face and a code panel.',
  slime: 'A glossy, bouncy code slime with a lucky star.',
  mage: 'A tiny programming wizard with a book of spells.',
  aquatic: 'A deep-sea puffer with curly dark hair and soft fins.',
  claude: 'A boxy orange pixel critter. Unofficial fan design.',
})

export const CHARACTER_IDS = Object.freeze(Object.keys(CHARACTER_DEFAULTS))

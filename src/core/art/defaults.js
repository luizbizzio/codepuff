// The characters, their display names and the colors each wears when the user has not chosen any.
// `body` is the main color (the cloud, the fox, the slime...); `accent` is the secondary one (headphones, hat,
// scarf, hair, cheeks...). Details with a fixed look (gold, goggles, screens, books) do not change.
export const CHARACTER_DEFAULTS = Object.freeze({
  alpha: { body: '#78c2ff', accent: '#ff9ec0' },
  classic: { body: '#efe9ff', accent: '#33336e' },
  fox: { body: '#f08c3c', accent: '#3a3550' },
  bot: { body: '#e8e4f6', accent: '#3b7be0' },
  slime: { body: '#37b4ff', accent: '#7fe0ff' },
  mage: { body: '#e8dcff', accent: '#6c3fb8' },
  aquatic: { body: '#d9cdfb', accent: '#35112e' },
  claude: { body: '#d97757', accent: '#c4633f' },
})

export const CHARACTER_NAMES = Object.freeze({
  alpha: 'Puff Alpha', classic: 'Puff Classic', fox: 'Puff Fox', bot: 'Puff Bot', slime: 'Puff Slime', mage: 'Puff Mage', aquatic: 'Puff Aquático', claude: 'Claude',
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

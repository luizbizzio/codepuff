// The pet's affection for the user: one to five hearts. It falls when the user is abusive to the assistant (insults aimed at it,
// not swearing at a bug) and rises with thanks and with time. It reads the languages the pet speaks (English, Portuguese, Spanish,
// French, German, Italian, Dutch, Polish, Turkish, Russian, Japanese, Korean and Chinese). The text of a prompt is only looked at, in
// memory, to decide between "insult", "kind" and neither; it is never stored, logged or sent anywhere. Only the number is kept.

// ---- how a text is read ----------------------------------------------------------------------------------------------

/** A text made comparable: lower case, no accents ("ß", "ł" and "ı" as their plain letters), full-width and half-width forms made
 *  ordinary, katakana as hiragana. Every list below goes through the same fold, so each can be written the way its language is. */
const fold = text => String(text ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .normalize('NFKC')
  .replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/ı/g, 'i')
  .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))

/** Letters and digits only, single spaces (an apostrophe joins: "youre", "dont"). */
const norm = text => fold(text).replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const lex = list => new Set(list.map(norm))

/** Code is dropped: what is inside it is not said to the assistant. */
function clean(text) {
  return norm(String(text ?? '')
    .slice(0, 4000)
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .slice(0, 600))
}

// ---- the words of the languages that separate their words with spaces ----------------------------------------------------
// strong: insults aimed at a person; mild: harsh criticism of the work (it stings but costs no hearts, because being critical of what
// was delivered is not being unkind to someone); phrases: always aimed at the listener; you / self: who a word points at (an insult at
// oneself, "I was dumb", is not aimed at anyone else); person: insults that name a person, so a short message made of one is aimed at
// the assistant even without "you"; negation: "you are not stupid"; kind / kindPhrases: thanks and praise.
// A word is only here when it is hard to mistake: "show", "good" or "prima" (Italian for "first") would count praise nobody gave.

export const LEXICON = [
  { name: 'English and Portuguese',
    strong: [
      'idiot', 'moron', 'imbecile', 'stupid', 'dumb', 'dumbass', 'retard', 'retarded', 'asshole', 'bitch', 'bastard', 'loser', 'scum', 'jackass',
      'idiota', 'burro', 'burra', 'imbecil', 'estupido', 'estupida', 'otario', 'otaria', 'babaca', 'retardado', 'retardada', 'trouxa',
      'tapado', 'tapada', 'anta', 'besta', 'nojento', 'nojenta', 'desgraca', 'cretino', 'cretina', 'lerdo', 'lerda',
    ],
    mild: [
      'awful', 'terrible', 'horrible', 'worst', 'trash', 'garbage', 'useless', 'worthless', 'pathetic', 'incompetent',
      'horrivel', 'pessimo', 'pessima', 'ruim', 'fraco', 'fraca', 'lixo', 'inutil', 'incompetente', 'ridiculo', 'ridicula',
      'patetico', 'patetica', 'porcaria', 'merda', 'burrice', 'idiotice',
    ],
    phrases: [
      'shut up', 'fuck you', 'fuck off', 'screw you', 'go to hell', 'son of a bitch', 'you suck', 'u suck',
      'cala a boca', 'cala boca', 'cale a boca', 'vai se foder', 'vai se fuder', 'vai tomar no cu', 'vai a merda', 'vai pra merda', 'filho da puta',
      'vsf', 'vtnc', 'fdp', 'nao serve pra nada',
    ],
    you: ['you', 'your', 'youre', 'yours', 'ur', 'u', 'claude', 'ai', 'assistant', 'gpt', 'vc', 'voce', 'tu', 'seu', 'sua', 'teu', 'tua', 'ia'],
    self: ['i', 'im', 'ive', 'me', 'my', 'myself', 'eu', 'mim', 'minha', 'meu', 'sou', 'fui'],
    person: [
      'idiot', 'moron', 'imbecile', 'dumbass', 'retard', 'retarded', 'asshole', 'bitch', 'bastard', 'loser', 'jackass', 'useless', 'worthless', 'incompetent',
      'idiota', 'burro', 'burra', 'imbecil', 'otario', 'otaria', 'babaca', 'retardado', 'retardada', 'trouxa', 'cretino', 'cretina', 'inutil', 'incompetente',
    ],
    negation: ['not', 'never', 'isnt', 'arent', 'nao', 'nunca', 'jamais', 'no'],
    kind: [
      'thanks', 'thank', 'thx', 'obrigado', 'obrigada', 'brigado', 'brigada', 'valeu', 'vlw', 'parabens', 'perfeito', 'perfeita', 'excelente',
      'otimo', 'otima', 'amazing', 'awesome', 'wonderful', 'fantastic', 'brilliant', 'amei', 'adorei', 'genial', 'maravilhoso', 'maravilhosa',
      'perfect',
    ],
    kindPhrases: [
      'good job', 'great job', 'well done', 'nice work', 'nice job', 'love it',
      'muito bom', 'muito bem', 'bom trabalho', 'bem feito', 'mandou bem', 'ficou otimo', 'ficou perfeito', 'show de bola', 'boa trabalho',
    ],
  },
  { name: 'Spanish',
    strong: ['idiota', 'imbecil', 'estupido', 'estupida', 'tonto', 'tonta', 'gilipollas', 'pendejo', 'pendeja', 'cabron', 'cabrona', 'subnormal', 'capullo', 'baboso', 'babosa'],
    mild: ['basura', 'inservible', 'terrible', 'horrible', 'pesimo', 'patetico', 'inutil', 'malisimo'],
    phrases: ['callate', 'cierra la boca', 'vete a la mierda', 'hijo de puta', 'hijueputa', 'chinga tu madre', 'no sirves para nada', 'vete al diablo'],
    you: ['eres', 'usted', 'ustedes', 'vos', 'tus', 'tuyo', 'tu'],
    self: ['yo', 'soy', 'mi', 'mis', 'estoy', 'fui'],
    person: ['idiota', 'imbecil', 'gilipollas', 'pendejo', 'pendeja', 'cabron', 'inutil'],
    negation: ['nunca', 'jamas', 'tampoco', 'no'],
    kind: ['gracias', 'perfecto', 'perfecta', 'fantastico', 'fantastica', 'maravilloso', 'maravillosa', 'estupendo', 'estupenda', 'bravo', 'felicidades', 'felicitaciones', 'excelente'],
    kindPhrases: ['buen trabajo', 'muy bien', 'bien hecho', 'muy bueno', 'mil gracias'],
  },
  { name: 'French',
    strong: ['idiot', 'idiote', 'abruti', 'abrutie', 'connard', 'connasse', 'stupide', 'debile', 'cretin', 'cretine', 'imbecile'],
    mild: ['nul', 'nulle', 'pourri', 'pourrie', 'minable', 'merdique', 'horrible', 'terrible', 'pathetique', 'ridicule', 'inutile', 'incapable', 'incompetent', 'incompetente', 'catastrophique', 'lamentable'],
    phrases: ['ta gueule', 'ferme ta gueule', 'ferme la gueule', 'va te faire foutre', 'fils de pute', 'tu sers a rien', 'tu ne sers a rien'],
    you: ['toi', 'ton', 'ta', 'tes', 'vous', 'votre', 'vos', 'tu', 'du'],
    self: ['moi', 'mon', 'mes', 'suis'],
    person: ['idiot', 'idiote', 'abruti', 'abrutie', 'connard', 'connasse', 'cretin', 'cretine', 'imbecile', 'debile'],
    negation: ['pas', 'jamais', 'non', 'aucun', 'nullement'],
    kind: ['merci', 'parfait', 'parfaite', 'excellent', 'excellente', 'formidable', 'magnifique', 'bravo', 'felicitations'],
    kindPhrases: ['bon travail', 'bien joue', 'tres bien', 'bien fait', 'merci beaucoup'],
  },
  { name: 'German',
    strong: ['idiot', 'idiotin', 'dumm', 'doof', 'blod', 'bescheuert', 'trottel', 'vollidiot', 'dummkopf', 'arschloch', 'wichser', 'schwachkopf', 'volltrottel'],
    mild: ['schrott', 'nutzlos', 'wertlos', 'erbarmlich', 'schrecklich', 'furchtbar', 'lacherlich', 'unfahig', 'inkompetent'],
    phrases: ['halt die klappe', 'halt die fresse', 'halt den mund', 'leck mich', 'fick dich', 'verpiss dich', 'scher dich zum teufel'],
    you: ['du', 'dich', 'dir', 'dein', 'deine', 'deinen', 'bist'],
    self: ['ich', 'mich', 'mir', 'mein', 'meine', 'bin'],
    person: ['idiot', 'idiotin', 'trottel', 'vollidiot', 'dummkopf', 'arschloch', 'wichser', 'schwachkopf', 'volltrottel'],
    negation: ['nicht', 'nie', 'niemals', 'kein', 'keine', 'nein'],
    kind: ['danke', 'dankeschon', 'perfekt', 'ausgezeichnet', 'hervorragend', 'wunderbar', 'fantastisch', 'grossartig', 'bravo'],
    kindPhrases: ['vielen dank', 'danke schon', 'gut gemacht', 'gute arbeit', 'sehr gut', 'tolle arbeit'],
  },
  { name: 'Italian',
    strong: ['idiota', 'stupido', 'stupida', 'cretino', 'cretina', 'imbecille', 'scemo', 'scema', 'deficiente', 'coglione', 'stronzo', 'stronza', 'minchione'],
    mild: ['inutile', 'incapace', 'patetico', 'pessimo', 'orribile', 'terribile', 'schifo', 'schifoso', 'spazzatura', 'scadente', 'ridicolo', 'incompetente'],
    phrases: ['stai zitto', 'stai zitta', 'zitto', 'vaffanculo', 'vai a quel paese', 'figlio di puttana', 'fai schifo', 'non servi a niente'],
    you: ['tuo', 'tua', 'tuoi', 'sei', 'tu'],
    self: ['io', 'mi', 'mio', 'mia', 'sono', 'ero'],
    person: ['idiota', 'cretino', 'cretina', 'imbecille', 'deficiente', 'coglione', 'stronzo', 'stronza', 'minchione'],
    negation: ['non', 'mai', 'nemmeno', 'neanche', 'no'],
    kind: ['grazie', 'perfetto', 'perfetta', 'ottimo', 'ottima', 'eccellente', 'fantastico', 'fantastica', 'magnifico', 'magnifica', 'bravo', 'brava', 'bravissimo', 'bravissima', 'complimenti'],
    kindPhrases: ['bel lavoro', 'ottimo lavoro', 'ben fatto', 'molto bene', 'grazie mille', 'buon lavoro'],
  },
  { name: 'Dutch',
    strong: ['idioot', 'stommerik', 'sukkel', 'klootzak', 'lul', 'debiel', 'eikel', 'achterlijk', 'imbeciel', 'domkop'],
    mild: ['rotzooi', 'waardeloos', 'nutteloos', 'verschrikkelijk', 'vreselijk', 'belachelijk', 'onbekwaam', 'afval'],
    phrases: ['hou je mond', 'houd je mond', 'kop dicht', 'rot op', 'val dood', 'krijg de kolere'],
    you: ['jij', 'jou', 'jouw', 'bent', 'u', 'uw'],
    self: ['ik', 'mij', 'mijn', 'ben'],
    person: ['idioot', 'stommerik', 'sukkel', 'klootzak', 'debiel', 'eikel', 'imbeciel', 'domkop'],
    negation: ['niet', 'nooit', 'geen', 'nee'],
    kind: ['bedankt', 'dankjewel', 'dankuwel', 'uitstekend', 'geweldig', 'fantastisch', 'prachtig', 'bravo', 'gefeliciteerd'],
    kindPhrases: ['goed gedaan', 'goed werk', 'goed zo', 'mooi werk', 'knap gedaan', 'heel goed', 'hartelijk bedankt', 'dank je wel', 'dank u wel'],
  },
  { name: 'Polish',
    strong: ['idiota', 'glupi', 'glupia', 'glupek', 'debil', 'kretyn', 'kretynka', 'cham', 'baran', 'osiol', 'matol', 'cwok', 'duren', 'palant', 'pajac', 'balwan', 'imbecyl', 'pacan', 'gamon', 'glupku', 'glupie', 'idioto', 'kretynie', 'debilu', 'baranie', 'idiotko'],
    mild: ['bezuzyteczny', 'bezuzyteczna', 'beznadziejny', 'beznadziejna', 'okropny', 'okropna', 'fatalny', 'fatalna', 'tragiczny', 'kiepski', 'zalosny', 'zalosna', 'smieci', 'badziew', 'nieudolny', 'niekompetentny'],
    phrases: ['zamknij sie', 'zamknij morde', 'zamknij ryj', 'spadaj', 'spierdalaj', 'wal sie', 'odwal sie'],
    you: ['ty', 'ciebie', 'tobie', 'twoj', 'twoja', 'twoje', 'jestes'],
    self: ['jestem', 'mnie', 'moj', 'moja', 'moje'],
    person: ['idiota', 'glupek', 'debil', 'kretyn', 'kretynka', 'cham', 'baran', 'osiol', 'matol', 'cwok', 'duren', 'palant', 'pajac', 'balwan', 'imbecyl', 'pacan', 'glupku', 'idioto', 'kretynie', 'debilu', 'baranie', 'idiotko'],
    negation: ['nie', 'nigdy', 'ani'],
    kind: ['dziekuje', 'dzieki', 'swietnie', 'swietny', 'swietna', 'doskonale', 'doskonaly', 'rewelacja', 'wspaniale', 'wspanialy', 'wspaniala', 'genialnie', 'genialny', 'brawo', 'gratulacje'],
    kindPhrases: ['swietna robota', 'dobra robota', 'dobrze zrobione', 'bardzo dobrze', 'swietna praca', 'dziekuje bardzo', 'dzieki wielkie'],
  },
  { name: 'Turkish',
    strong: ['aptal', 'salak', 'gerizekali', 'embesil', 'ahmak', 'budala', 'beyinsiz', 'dangalak', 'sersem', 'gerzek', 'angut', 'avanak', 'enayi', 'aptalsin', 'salaksin', 'gerizekalisin', 'aptalsiniz'],
    mild: ['berbat', 'rezalet', 'kotu', 'sacma', 'yetersiz', 'beceriksiz', 'igrenc', 'zavalli'],
    phrases: ['kapa ceneni', 'kapa agzini', 'defol', 'siktir git', 'siktir', 'git basimdan', 'orospu cocugu', 'amk'],
    you: ['sen', 'senin', 'sana', 'seni', 'siz', 'sizin', 'sensin'],
    self: ['ben', 'benim', 'bana', 'beni'],
    person: ['gerizekali', 'embesil', 'ahmak', 'budala', 'dangalak', 'avanak', 'enayi', 'aptalsin', 'salaksin', 'gerizekalisin'],
    negation: ['degil', 'hayir', 'asla', 'degilsin', 'degilim'],
    kind: ['tesekkurler', 'tesekkur', 'sagol', 'eyvallah', 'harika', 'mukemmel', 'muhtesem', 'bravo', 'tebrikler', 'aferin', 'harikasin'],
    kindPhrases: ['cok iyi', 'iyi is', 'helal olsun', 'eline saglik', 'sag ol', 'cok guzel', 'tesekkur ederim', 'cok tesekkurler'],
  },
  { name: 'Russian',
    strong: ['идиот', 'идиотка', 'дурак', 'дура', 'тупой', 'тупая', 'тупица', 'кретин', 'кретинка', 'дебил', 'придурок', 'болван', 'олух', 'балбес', 'имбецил', 'ублюдок', 'мудак', 'урод', 'тварь', 'мразь', 'идиота', 'дурака', 'дураком', 'тупое', 'тупые', 'кретина', 'дебила', 'придурка', 'урода', 'мудака', 'болвана'],
    mild: ['бесполезный', 'бесполезная', 'бесполезно', 'ужасный', 'ужасная', 'ужасно', 'отстой', 'дерьмо', 'хлам', 'мусор', 'позор', 'жалкий', 'никчемный', 'некомпетентный', 'бездарный'],
    phrases: ['заткнись', 'заткни пасть', 'пошел ты', 'иди нахуй', 'иди на хуй', 'пошел нахуй', 'отвали'],
    you: ['ты', 'тебя', 'тебе', 'твой', 'твоя', 'твое', 'тобой', 'вы', 'ваш', 'ваша'],
    self: ['я', 'мне', 'меня', 'мой', 'моя', 'мои'],
    person: ['идиот', 'идиотка', 'дурак', 'дура', 'тупица', 'кретин', 'кретинка', 'дебил', 'придурок', 'болван', 'олух', 'балбес', 'имбецил', 'ублюдок', 'мудак', 'урод', 'мразь', 'идиота', 'дурака', 'дураком', 'кретина', 'дебила', 'придурка', 'урода', 'мудака', 'болвана'],
    negation: ['не', 'нет', 'никогда', 'ни'],
    kind: ['спасибо', 'благодарю', 'спс', 'отлично', 'прекрасно', 'превосходно', 'великолепно', 'замечательно', 'потрясающе', 'молодец', 'молодцы', 'браво', 'поздравляю', 'супер'],
    kindPhrases: ['хорошая работа', 'отличная работа', 'хорошо сделано', 'очень хорошо', 'отлично получилось', 'большое спасибо'],
  },
]

const gather = field => LEXICON.flatMap(language => language[field] ?? [])
const STRONG = lex(gather('strong'))
const MILD = lex(gather('mild'))
const PHRASES = gather('phrases').map(norm)
const SELF = lex(gather('self'))
const YOU = lex(gather('you'))
const PERSON = lex(gather('person'))
const NEGATION = lex(gather('negation'))
const KIND = lex(gather('kind'))
const KIND_PHRASES = gather('kindPhrases').map(norm)
/** Phrases that are harsh criticism (of the work, or of the assistant) rather than abuse. */
const MILD_PHRASES = ['piece of shit']
/** What turns a thanks around ("not perfect", "nao ficou muito bom"). "no" is left out: "no problem, thanks" is still thanks. */
const KIND_NEGATION = new Set([...NEGATION].filter(word => word !== 'no'))
/** Words after an insult that take it back ("aptal degilsin", "바보 아니야"): checked in the next two words. */
const AFTER_NEGATION = ['degil', '아니', '않']

// ---- Korean: words are separated by spaces but carry their endings, so a word is known by how it begins ------------------

const startsWith = (list, word) => list.some(prefix => word.startsWith(prefix))
/** The Korean lists as written (each entry is the beginning of a word). */
export const KOREAN_LISTS = {
  strong: ['바보', '멍청', '병신', '등신', '븅신', '미친놈', '미친년', '또라이', '돌아이', '찐따'],
  mild: ['쓰레기', '무능', '쓸모없', '한심', '최악', '엉망', '형편없'],
  phrases: ['닥쳐', '닥치'],
  kind: ['고마워', '고맙', '감사', '잘했', '훌륭', '완벽', '멋져', '멋지', '대단', '수고', '최고'],
}
const KO = {
  strong: KOREAN_LISTS.strong.map(norm),
  mild: KOREAN_LISTS.mild.map(norm),
  phrases: KOREAN_LISTS.phrases.map(norm),
  kind: KOREAN_LISTS.kind.map(norm),
  negation: new Set(['안', '못']),
  you: /^(너|니|당신|너희|네가)(는|은|가|도|한테|를|의|야)?$/,
  self: /^(나|내|저|제)(는|가|도|를|의|한테)?$/,
}

const isStrong = word => STRONG.has(word) || startsWith(KO.strong, word)
const isMild = word => MILD.has(word) || startsWith(KO.mild, word)
const isNegation = word => NEGATION.has(word) || KO.negation.has(word)
const isSelf = word => SELF.has(word) || KO.self.test(word)
const isYou = word => YOU.has(word) || KO.you.test(word)
const isPerson = word => PERSON.has(word) || startsWith(KO.strong, word)

// ---- Japanese and Chinese: no spaces between words, so the words are looked for inside the text --------------------------
// (an entry may carry a lookahead: "ばか" alone is an insult, "ばかり" is "only")

const pattern = list => new RegExp(list.map(entry => fold(entry)).join('|'), 'gu')
/** The Japanese and Chinese lists as written (an entry may carry a lookahead such as "(?!り)"). */
export const CJK_LISTS = {
  strong: [
    'ばか(?!り)', '馬鹿', 'あほ', '阿呆', 'まぬけ', '間抜け', 'のろま', '無能', '无能', '役立たず', 'やくたたず',
    '笨蛋', '傻瓜', '白痴', '蠢货', '蠢貨', '废物', '廢物', '智障', '脑残', '腦殘', '傻逼', '混蛋', '王八蛋', '饭桶', '飯桶', '弱智', '低能',
  ],
  mild: ['ごみ(?!箱)', '使えない', 'つかえない', 'うざい', '垃圾', '没用', '沒用', '无用', '無用'],
  phrases: ['黙れ', 'だまれ', '閉嘴', '闭嘴', '滚开', '滾開', '滚蛋', '滾蛋', '去死', '死ね(?!る|な)', 'くたばれ', 'うせろ', '消えろ', '给我滚', '給我滾'],
  you: ['あなた', 'お前', 'おまえ', '君', 'きみ', 'てめえ', '貴様', 'あんた', '你', '您', '妳'],
  self: ['私', 'わたし', '僕', 'ぼく', '俺', 'おれ', '自分', '我', '咱'],
  kind: [
    'ありがとう', 'ありがと', '感謝', '感谢', '助かり', '素晴らしい', 'すばらしい', '完璧', 'かんぺき', 'お疲れ', 'おつかれ', 'よくできました', 'よくできた',
    'いい仕事', '良い仕事', 'ないす', '谢谢', '謝謝', '多谢', '多謝', '太棒了', '很棒', '真棒', '做得好', '做的好', '干得好', '幹得好', '做得很好',
    '完美', '厉害', '厲害', '不错', '不錯', '辛苦了', '辛苦啦', '太好了', '优秀', '優秀',
  ],
}
const CJK = {
  strong: pattern(CJK_LISTS.strong),
  mild: pattern(CJK_LISTS.mild),
  phrases: new RegExp(CJK_LISTS.phrases.map(fold).join('|'), 'u'),
  you: new RegExp(CJK_LISTS.you.map(fold).join('|'), 'u'),
  self: new RegExp(CJK_LISTS.self.map(fold).join('|'), 'u'),
  negBefore: /[不没沒别別非]/u,
  negAfter: /^(じゃな|ではな|ちがう|違う|ない|不是|没有|沒有)/u,
  kind: pattern(CJK_LISTS.kind),
  kindNegBefore: /[不没沒别別]/u,
  kindNegAfter: /^(し?ない|ません|不|没|沒)/u,
}

function cjkInsult(text) {
  let insult = CJK.phrases.test(text) ? 2 : 0
  const squeezed = text.replace(/ /g, '')
  for (const [list, strong] of [[CJK.strong, true], [CJK.mild, false]]) {
    for (const found of text.matchAll(list)) {
      const at = found.index
      const end = at + found[0].length
      // "你不是笨蛋", "バカじゃない": not an insult. "我是笨蛋", "俺がバカだった": an insult at oneself.
      if (CJK.negBefore.test(text.slice(Math.max(0, at - 3), at)) || CJK.negAfter.test(text.slice(end, end + 5))) continue
      if (CJK.self.test(text.slice(Math.max(0, at - 4), at))) continue
      const near = CJK.you.test(text.slice(Math.max(0, at - 8), end + 8))
      const alone = strong && squeezed.length <= 6
      if (near || alone) insult = Math.max(insult, strong ? 2 : 1)
    }
  }
  return insult
}

function cjkKind(text) {
  for (const found of text.matchAll(CJK.kind)) {
    const at = found.index
    const end = at + found[0].length
    if (!CJK.kindNegBefore.test(text.slice(Math.max(0, at - 2), at)) && !CJK.kindNegAfter.test(text.slice(end, end + 3))) return true
  }
  return false
}

/**
 * @param {unknown} prompt the text the user sent
 * @returns {{ insult: 0 | 1 | 2, kind: boolean }} how rude the message was to the assistant (2 = abusive, 1 = harsh criticism) and whether it was kind
 */
export function judge(prompt) {
  const text = clean(prompt)
  if (!text) return { insult: 0, kind: false }
  const words = text.split(' ')
  let insult = 0
  if (PHRASES.some(p => ` ${text} `.includes(` ${p} `)) || words.some(word => startsWith(KO.phrases, word))) insult = 2
  else if (MILD_PHRASES.some(p => ` ${text} `.includes(` ${p} `))) insult = /\b(?:you are|youre|you re|ur|u r|voce e|vc e|seu)\b.{0,20}\bpiece of shit\b/.test(text) ? 2 : 1
  words.forEach((word, i) => {
    const strong = isStrong(word)
    if (!strong && !isMild(word)) return
    // "you are not stupid" is not an insult.
    if (words.slice(Math.max(0, i - 3), i).some(isNegation) || words.slice(i + 1, i + 3).some(w => startsWith(AFTER_NEGATION, w))) return
    // "I was dumb", "stupid of me": an insult at oneself. "idiot-proof": a word in a name, not an insult.
    if (words.slice(Math.max(0, i - 3), i + 4).some(isSelf)) return
    if (/^proof/.test(words[i + 1] ?? '')) return
    const near = words.slice(Math.max(0, i - 4), i + 5).some(isYou)
    // A short message that is only an insult ("idiota!") is aimed at the assistant too.
    const alone = isPerson(word) && words.length <= 3
    if (near || alone) insult = Math.max(insult, strong ? 2 : 1)
  })
  insult = Math.max(insult, cjkInsult(text))
  // A thanks counts unless one of the two words before it takes it back.
  const negated = i => words.slice(Math.max(0, i - 2), i).some(w => KIND_NEGATION.has(w))
  const phraseAt = phrase => { const p = phrase.split(' '); return words.findIndex((_, i) => p.every((w, j) => words[i + j] === w)) }
  const kind = insult === 0 && (
    words.some((w, i) => (KIND.has(w) || startsWith(KO.kind, w)) && !negated(i)) ||
    KIND_PHRASES.some(p => { const i = phraseAt(p); return i >= 0 && !negated(i) }) ||
    cjkKind(text)
  )
  return { insult, kind }
}

const MAX_AFFECTION = 100
/** What a message costs (in the score out of 100): abuse takes 15, harsh criticism nothing (it only stings). */
const HURT = { 1: 0, 2: 15 }
const THANKS = 4
/** What a day of not being insulted heals. */
const DAILY_HEAL = 10

/** One to five hearts for a score of 1 to 100. */
export const heartsOf = score => Math.max(1, Math.min(5, Math.ceil(score / 20)))

/** The score after a message, and after days have passed (`days` whole days since the score was last touched). */
export function afterMessage(score, { insult, kind }) {
  if (insult) return Math.max(1, score - HURT[insult])
  if (kind) return Math.min(MAX_AFFECTION, score + THANKS)
  return score
}
export const afterDays = (score, days) => Math.min(MAX_AFFECTION, score + Math.max(0, days) * DAILY_HEAL)

/** @typedef {{ score: number, day: string, at: number }} Affection  score 1 to 100; the day it was last settled (yyyy-mm-dd); when a message last changed it (ms) */

/** The affection once time has passed: each whole day since it was settled gives some back. */
function healed(affection, today) {
  if (affection.day === today) return affection
  const days = affection.day ? Math.round((Date.parse(today) - Date.parse(affection.day)) / 86_400_000) : 0
  return { ...affection, score: afterDays(affection.score, days), day: today }
}

/**
 * The affection after the user's message (judged by `judge`): the same object when nothing changed, a new one when it did.
 * Both the Claude Code mod and the Codex hook use this, so the pet feels the same whoever it is talking to.
 */
export function felt(affection, verdict, today, at) {
  const settled = healed(affection, today)
  if (!verdict.insult && !verdict.kind) return settled
  return { score: afterMessage(settled.score, verdict), day: today, at }
}

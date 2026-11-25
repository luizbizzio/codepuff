# Reviewing the pet's word lists

The pet has one to five hearts for you. They drop when you are abusive to the assistant and rise with thanks (see [Hearts](FEATURES.md#hearts)).
To tell the difference, a message is read once, in memory, against the lists below; it is never stored, logged or sent anywhere.

The lists were written by the author, not by native speakers of every language, and they will have mistakes. **If you speak one of these
languages, please read its section and tell us what is wrong.** It takes a few minutes and it is the most useful thing you can do for
this part of the project.

## What to look for

1. **A word that should not be there.** It is normal in a programming conversation, or it only sometimes insults, so it would take
   hearts from someone who was not rude. (Example of what we avoided: the Italian *prima* means "first"; the English *show* is a command.)
2. **A word that is missing.** A common insult or a common way to say thanks that the pet does not know.
3. **A word in the wrong group.** Harsh criticism of the work ("this code is garbage") only makes the pet flinch; real abuse aimed at it costs hearts.
4. **A wrong form.** Languages that change their words (Russian, Polish, Turkish) are only covered for the commonest forms.

## How to send it

- Open an issue at <https://github.com/luizbizzio/codepuff/issues> with the language and the words to add or remove, or
- change the list yourself: it is a plain list in [`src/core/mood.js`](../src/core/mood.js), and add a sentence or two for it to
  `test/mood.test.js` (there is a table of examples for every language). `npm test` must still pass.

Accents and capital letters do not matter (the text is folded first), and an apostrophe joins a word ("don't" is read as "dont").

## The lists

### English and Portuguese

| What it is | Words |
| --- | --- |
| Insults (cost hearts when aimed at the assistant) | `idiot` · `moron` · `imbecile` · `stupid` · `dumb` · `dumbass` · `retard` · `retarded` · `asshole` · `bitch` · `bastard` · `loser` · `scum` · `jackass` · `idiota` · `burro` · `burra` · `imbecil` · `estupido` · `estupida` · `otario` · `otaria` · `babaca` · `retardado` · `retardada` · `trouxa` · `tapado` · `tapada` · `anta` · `besta` · `nojento` · `nojenta` · `desgraca` · `cretino` · `cretina` · `lerdo` · `lerda` |
| Harsh criticism of the work (a flinch, no hearts lost) | `awful` · `terrible` · `horrible` · `worst` · `trash` · `garbage` · `useless` · `worthless` · `pathetic` · `incompetent` · `horrivel` · `pessimo` · `pessima` · `ruim` · `fraco` · `fraca` · `lixo` · `inutil` · `incompetente` · `ridiculo` · `ridicula` · `patetico` · `patetica` · `porcaria` · `merda` · `burrice` · `idiotice` |
| Phrases that are always aimed at the listener | `shut up` · `fuck you` · `fuck off` · `screw you` · `go to hell` · `son of a bitch` · `you suck` · `u suck` · `cala a boca` · `cala boca` · `cale a boca` · `vai se foder` · `vai se fuder` · `vai tomar no cu` · `vai a merda` · `vai pra merda` · `filho da puta` · `vsf` · `vtnc` · `fdp` · `nao serve pra nada` |
| Thanks and praise (words) | `thanks` · `thank` · `thx` · `obrigado` · `obrigada` · `brigado` · `brigada` · `valeu` · `vlw` · `parabens` · `perfeito` · `perfeita` · `excelente` · `otimo` · `otima` · `amazing` · `awesome` · `wonderful` · `fantastic` · `brilliant` · `amei` · `adorei` · `genial` · `maravilhoso` · `maravilhosa` · `perfect` |
| Thanks and praise (phrases) | `good job` · `great job` · `well done` · `nice work` · `nice job` · `love it` · `muito bom` · `muito bem` · `bom trabalho` · `bem feito` · `mandou bem` · `ficou otimo` · `ficou perfeito` · `show de bola` · `boa trabalho` |
| Words that mean "you" (an insult near one is aimed at the assistant) | `you` · `your` · `youre` · `yours` · `ur` · `u` · `claude` · `ai` · `assistant` · `gpt` · `vc` · `voce` · `tu` · `seu` · `sua` · `teu` · `tua` · `ia` |
| Words that mean "I" (an insult near one is the speaker's own) | `i` · `im` · `ive` · `me` · `my` · `myself` · `eu` · `mim` · `minha` · `meu` · `sou` · `fui` |
| Words that turn a sentence around ("not") | `not` · `never` · `isnt` · `arent` · `nao` · `nunca` · `jamais` · `no` |

### Spanish

| What it is | Words |
| --- | --- |
| Insults (cost hearts when aimed at the assistant) | `idiota` · `imbecil` · `estupido` · `estupida` · `tonto` · `tonta` · `gilipollas` · `pendejo` · `pendeja` · `cabron` · `cabrona` · `subnormal` · `capullo` · `baboso` · `babosa` |
| Harsh criticism of the work (a flinch, no hearts lost) | `basura` · `inservible` · `terrible` · `horrible` · `pesimo` · `patetico` · `inutil` · `malisimo` |
| Phrases that are always aimed at the listener | `callate` · `cierra la boca` · `vete a la mierda` · `hijo de puta` · `hijueputa` · `chinga tu madre` · `no sirves para nada` · `vete al diablo` |
| Thanks and praise (words) | `gracias` · `perfecto` · `perfecta` · `fantastico` · `fantastica` · `maravilloso` · `maravillosa` · `estupendo` · `estupenda` · `bravo` · `felicidades` · `felicitaciones` · `excelente` |
| Thanks and praise (phrases) | `buen trabajo` · `muy bien` · `bien hecho` · `muy bueno` · `mil gracias` |
| Words that mean "you" (an insult near one is aimed at the assistant) | `eres` · `usted` · `ustedes` · `vos` · `tus` · `tuyo` · `tu` |
| Words that mean "I" (an insult near one is the speaker's own) | `yo` · `soy` · `mi` · `mis` · `estoy` · `fui` |
| Words that turn a sentence around ("not") | `nunca` · `jamas` · `tampoco` · `no` |

### French

| What it is | Words |
| --- | --- |
| Insults (cost hearts when aimed at the assistant) | `idiot` · `idiote` · `abruti` · `abrutie` · `connard` · `connasse` · `stupide` · `debile` · `cretin` · `cretine` · `imbecile` |
| Harsh criticism of the work (a flinch, no hearts lost) | `nul` · `nulle` · `pourri` · `pourrie` · `minable` · `merdique` · `horrible` · `terrible` · `pathetique` · `ridicule` · `inutile` · `incapable` · `incompetent` · `incompetente` · `catastrophique` · `lamentable` |
| Phrases that are always aimed at the listener | `ta gueule` · `ferme ta gueule` · `ferme la gueule` · `va te faire foutre` · `fils de pute` · `tu sers a rien` · `tu ne sers a rien` |
| Thanks and praise (words) | `merci` · `parfait` · `parfaite` · `excellent` · `excellente` · `formidable` · `magnifique` · `bravo` · `felicitations` |
| Thanks and praise (phrases) | `bon travail` · `bien joue` · `tres bien` · `bien fait` · `merci beaucoup` |
| Words that mean "you" (an insult near one is aimed at the assistant) | `toi` · `ton` · `ta` · `tes` · `vous` · `votre` · `vos` · `tu` · `du` |
| Words that mean "I" (an insult near one is the speaker's own) | `moi` · `mon` · `mes` · `suis` |
| Words that turn a sentence around ("not") | `pas` · `jamais` · `non` · `aucun` · `nullement` |

### German

| What it is | Words |
| --- | --- |
| Insults (cost hearts when aimed at the assistant) | `idiot` · `idiotin` · `dumm` · `doof` · `blod` · `bescheuert` · `trottel` · `vollidiot` · `dummkopf` · `arschloch` · `wichser` · `schwachkopf` · `volltrottel` |
| Harsh criticism of the work (a flinch, no hearts lost) | `schrott` · `nutzlos` · `wertlos` · `erbarmlich` · `schrecklich` · `furchtbar` · `lacherlich` · `unfahig` · `inkompetent` |
| Phrases that are always aimed at the listener | `halt die klappe` · `halt die fresse` · `halt den mund` · `leck mich` · `fick dich` · `verpiss dich` · `scher dich zum teufel` |
| Thanks and praise (words) | `danke` · `dankeschon` · `perfekt` · `ausgezeichnet` · `hervorragend` · `wunderbar` · `fantastisch` · `grossartig` · `bravo` |
| Thanks and praise (phrases) | `vielen dank` · `danke schon` · `gut gemacht` · `gute arbeit` · `sehr gut` · `tolle arbeit` |
| Words that mean "you" (an insult near one is aimed at the assistant) | `du` · `dich` · `dir` · `dein` · `deine` · `deinen` · `bist` |
| Words that mean "I" (an insult near one is the speaker's own) | `ich` · `mich` · `mir` · `mein` · `meine` · `bin` |
| Words that turn a sentence around ("not") | `nicht` · `nie` · `niemals` · `kein` · `keine` · `nein` |

### Italian

| What it is | Words |
| --- | --- |
| Insults (cost hearts when aimed at the assistant) | `idiota` · `stupido` · `stupida` · `cretino` · `cretina` · `imbecille` · `scemo` · `scema` · `deficiente` · `coglione` · `stronzo` · `stronza` · `minchione` |
| Harsh criticism of the work (a flinch, no hearts lost) | `inutile` · `incapace` · `patetico` · `pessimo` · `orribile` · `terribile` · `schifo` · `schifoso` · `spazzatura` · `scadente` · `ridicolo` · `incompetente` |
| Phrases that are always aimed at the listener | `stai zitto` · `stai zitta` · `zitto` · `vaffanculo` · `vai a quel paese` · `figlio di puttana` · `fai schifo` · `non servi a niente` |
| Thanks and praise (words) | `grazie` · `perfetto` · `perfetta` · `ottimo` · `ottima` · `eccellente` · `fantastico` · `fantastica` · `magnifico` · `magnifica` · `bravo` · `brava` · `bravissimo` · `bravissima` · `complimenti` |
| Thanks and praise (phrases) | `bel lavoro` · `ottimo lavoro` · `ben fatto` · `molto bene` · `grazie mille` · `buon lavoro` |
| Words that mean "you" (an insult near one is aimed at the assistant) | `tuo` · `tua` · `tuoi` · `sei` · `tu` |
| Words that mean "I" (an insult near one is the speaker's own) | `io` · `mi` · `mio` · `mia` · `sono` · `ero` |
| Words that turn a sentence around ("not") | `non` · `mai` · `nemmeno` · `neanche` · `no` |

### Dutch

| What it is | Words |
| --- | --- |
| Insults (cost hearts when aimed at the assistant) | `idioot` · `stommerik` · `sukkel` · `klootzak` · `lul` · `debiel` · `eikel` · `achterlijk` · `imbeciel` · `domkop` |
| Harsh criticism of the work (a flinch, no hearts lost) | `rotzooi` · `waardeloos` · `nutteloos` · `verschrikkelijk` · `vreselijk` · `belachelijk` · `onbekwaam` · `afval` |
| Phrases that are always aimed at the listener | `hou je mond` · `houd je mond` · `kop dicht` · `rot op` · `val dood` · `krijg de kolere` |
| Thanks and praise (words) | `bedankt` · `dankjewel` · `dankuwel` · `uitstekend` · `geweldig` · `fantastisch` · `prachtig` · `bravo` · `gefeliciteerd` |
| Thanks and praise (phrases) | `goed gedaan` · `goed werk` · `goed zo` · `mooi werk` · `knap gedaan` · `heel goed` · `hartelijk bedankt` · `dank je wel` · `dank u wel` |
| Words that mean "you" (an insult near one is aimed at the assistant) | `jij` · `jou` · `jouw` · `bent` · `u` · `uw` |
| Words that mean "I" (an insult near one is the speaker's own) | `ik` · `mij` · `mijn` · `ben` |
| Words that turn a sentence around ("not") | `niet` · `nooit` · `geen` · `nee` |

### Polish

| What it is | Words |
| --- | --- |
| Insults (cost hearts when aimed at the assistant) | `idiota` · `glupi` · `glupia` · `glupek` · `debil` · `kretyn` · `kretynka` · `cham` · `baran` · `osiol` · `matol` · `cwok` · `duren` · `palant` · `pajac` · `balwan` · `imbecyl` · `pacan` · `gamon` · `glupku` · `glupie` · `idioto` · `kretynie` · `debilu` · `baranie` · `idiotko` |
| Harsh criticism of the work (a flinch, no hearts lost) | `bezuzyteczny` · `bezuzyteczna` · `beznadziejny` · `beznadziejna` · `okropny` · `okropna` · `fatalny` · `fatalna` · `tragiczny` · `kiepski` · `zalosny` · `zalosna` · `smieci` · `badziew` · `nieudolny` · `niekompetentny` |
| Phrases that are always aimed at the listener | `zamknij sie` · `zamknij morde` · `zamknij ryj` · `spadaj` · `spierdalaj` · `wal sie` · `odwal sie` |
| Thanks and praise (words) | `dziekuje` · `dzieki` · `swietnie` · `swietny` · `swietna` · `doskonale` · `doskonaly` · `rewelacja` · `wspaniale` · `wspanialy` · `wspaniala` · `genialnie` · `genialny` · `brawo` · `gratulacje` |
| Thanks and praise (phrases) | `swietna robota` · `dobra robota` · `dobrze zrobione` · `bardzo dobrze` · `swietna praca` · `dziekuje bardzo` · `dzieki wielkie` |
| Words that mean "you" (an insult near one is aimed at the assistant) | `ty` · `ciebie` · `tobie` · `twoj` · `twoja` · `twoje` · `jestes` |
| Words that mean "I" (an insult near one is the speaker's own) | `jestem` · `mnie` · `moj` · `moja` · `moje` |
| Words that turn a sentence around ("not") | `nie` · `nigdy` · `ani` |

### Turkish

| What it is | Words |
| --- | --- |
| Insults (cost hearts when aimed at the assistant) | `aptal` · `salak` · `gerizekali` · `embesil` · `ahmak` · `budala` · `beyinsiz` · `dangalak` · `sersem` · `gerzek` · `angut` · `avanak` · `enayi` · `aptalsin` · `salaksin` · `gerizekalisin` · `aptalsiniz` |
| Harsh criticism of the work (a flinch, no hearts lost) | `berbat` · `rezalet` · `kotu` · `sacma` · `yetersiz` · `beceriksiz` · `igrenc` · `zavalli` |
| Phrases that are always aimed at the listener | `kapa ceneni` · `kapa agzini` · `defol` · `siktir git` · `siktir` · `git basimdan` · `orospu cocugu` · `amk` |
| Thanks and praise (words) | `tesekkurler` · `tesekkur` · `sagol` · `eyvallah` · `harika` · `mukemmel` · `muhtesem` · `bravo` · `tebrikler` · `aferin` · `harikasin` |
| Thanks and praise (phrases) | `cok iyi` · `iyi is` · `helal olsun` · `eline saglik` · `sag ol` · `cok guzel` · `tesekkur ederim` · `cok tesekkurler` |
| Words that mean "you" (an insult near one is aimed at the assistant) | `sen` · `senin` · `sana` · `seni` · `siz` · `sizin` · `sensin` |
| Words that mean "I" (an insult near one is the speaker's own) | `ben` · `benim` · `bana` · `beni` |
| Words that turn a sentence around ("not") | `degil` · `hayir` · `asla` · `degilsin` · `degilim` |

### Russian

| What it is | Words |
| --- | --- |
| Insults (cost hearts when aimed at the assistant) | `идиот` · `идиотка` · `дурак` · `дура` · `тупой` · `тупая` · `тупица` · `кретин` · `кретинка` · `дебил` · `придурок` · `болван` · `олух` · `балбес` · `имбецил` · `ублюдок` · `мудак` · `урод` · `тварь` · `мразь` · `идиота` · `дурака` · `дураком` · `тупое` · `тупые` · `кретина` · `дебила` · `придурка` · `урода` · `мудака` · `болвана` |
| Harsh criticism of the work (a flinch, no hearts lost) | `бесполезный` · `бесполезная` · `бесполезно` · `ужасный` · `ужасная` · `ужасно` · `отстой` · `дерьмо` · `хлам` · `мусор` · `позор` · `жалкий` · `никчемный` · `некомпетентный` · `бездарный` |
| Phrases that are always aimed at the listener | `заткнись` · `заткни пасть` · `пошел ты` · `иди нахуй` · `иди на хуй` · `пошел нахуй` · `отвали` |
| Thanks and praise (words) | `спасибо` · `благодарю` · `спс` · `отлично` · `прекрасно` · `превосходно` · `великолепно` · `замечательно` · `потрясающе` · `молодец` · `молодцы` · `браво` · `поздравляю` · `супер` |
| Thanks and praise (phrases) | `хорошая работа` · `отличная работа` · `хорошо сделано` · `очень хорошо` · `отлично получилось` · `большое спасибо` |
| Words that mean "you" (an insult near one is aimed at the assistant) | `ты` · `тебя` · `тебе` · `твой` · `твоя` · `твое` · `тобой` · `вы` · `ваш` · `ваша` |
| Words that mean "I" (an insult near one is the speaker's own) | `я` · `мне` · `меня` · `мой` · `моя` · `мои` |
| Words that turn a sentence around ("not") | `не` · `нет` · `никогда` · `ни` |

### Korean (a word is known by how it begins)

| What it is | Words |
| --- | --- |
| Insults | `바보` · `멍청` · `병신` · `등신` · `븅신` · `미친놈` · `미친년` · `또라이` · `돌아이` · `찐따` |
| Harsh criticism of the work | `쓰레기` · `무능` · `쓸모없` · `한심` · `최악` · `엉망` · `형편없` |
| Always aimed at the listener | `닥쳐` · `닥치` |
| Thanks and praise | `고마워` · `고맙` · `감사` · `잘했` · `훌륭` · `완벽` · `멋져` · `멋지` · `대단` · `수고` · `최고` |

### Japanese and Chinese (no spaces: the words are looked for inside the text; `(?!り)` means "not followed by り")

| What it is | Words |
| --- | --- |
| Insults | `ばか(?!り)` · `馬鹿` · `あほ` · `阿呆` · `まぬけ` · `間抜け` · `のろま` · `無能` · `无能` · `役立たず` · `やくたたず` · `笨蛋` · `傻瓜` · `白痴` · `蠢货` · `蠢貨` · `废物` · `廢物` · `智障` · `脑残` · `腦殘` · `傻逼` · `混蛋` · `王八蛋` · `饭桶` · `飯桶` · `弱智` · `低能` |
| Harsh criticism of the work | `ごみ(?!箱)` · `使えない` · `つかえない` · `うざい` · `垃圾` · `没用` · `沒用` · `无用` · `無用` |
| Always aimed at the listener | `黙れ` · `だまれ` · `閉嘴` · `闭嘴` · `滚开` · `滾開` · `滚蛋` · `滾蛋` · `去死` · `死ね(?!る|な)` · `くたばれ` · `うせろ` · `消えろ` · `给我滚` · `給我滾` |
| Words that mean "you" | `あなた` · `お前` · `おまえ` · `君` · `きみ` · `てめえ` · `貴様` · `あんた` · `你` · `您` · `妳` |
| Words that mean "I" | `私` · `わたし` · `僕` · `ぼく` · `俺` · `おれ` · `自分` · `我` · `咱` |
| Thanks and praise | `ありがとう` · `ありがと` · `感謝` · `感谢` · `助かり` · `素晴らしい` · `すばらしい` · `完璧` · `かんぺき` · `お疲れ` · `おつかれ` · `よくできました` · `よくできた` · `いい仕事` · `良い仕事` · `ないす` · `谢谢` · `謝謝` · `多谢` · `多謝` · `太棒了` · `很棒` · `真棒` · `做得好` · `做的好` · `干得好` · `幹得好` · `做得很好` · `完美` · `厉害` · `厲害` · `不错` · `不錯` · `辛苦了` · `辛苦啦` · `太好了` · `优秀` · `優秀` |

<sub>Generated by <code>scripts/mood-review.mjs</code> from <code>src/core/mood.js</code>.</sub>

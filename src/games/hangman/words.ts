/**
 * The word list for Hangman: curated by hand, stored here, never fetched. Every word is a single lowercase word
 * (letters a to z only) suitable for a general audience, with a short clue that never contains the word itself.
 * Each category has ten words at each of three difficulties: Easy (short, familiar), Medium (longer or less common),
 * Hard (long or tricky to spell). Format of each line: `word|clue`.
 */
export const CATEGORIES = [
  ['animals', 'Animals'],
  ['countries', 'Countries'],
  ['food', 'Food'],
  ['technology', 'Technology'],
  ['science', 'Science'],
  ['movies', 'Movies'],
  ['sports', 'Sports'],
  ['general', 'General knowledge'],
  ['nature', 'Nature'],
  ['history', 'History'],
] as const
export type CategoryId = (typeof CATEGORIES)[number][0]
export type Difficulty = 'easy' | 'medium' | 'hard'
export const DIFFICULTIES: [Difficulty, string][] = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]

const RAW: Record<CategoryId, Record<Difficulty, string>> = {
  animals: {
    easy: `tiger|A big cat with stripes
panda|Black and white, and loves bamboo
zebra|Looks like a striped horse
horse|You can ride one
rabbit|Hops and has long ears
sheep|Gives us wool
whale|The largest animal in the sea
eagle|A large bird of prey
mouse|A small rodent that squeaks
snake|Slithers without legs`,
    medium: `giraffe|The tallest animal on land
penguin|A flightless bird that loves the cold
dolphin|A clever sea mammal that clicks and whistles
kangaroo|Hops and carries its baby in a pouch
squirrel|Buries acorns for the winter
crocodile|A large reptile with powerful jaws
flamingo|A pink bird that stands on one leg
hedgehog|A small spiny mammal
octopus|Has eight arms and three hearts
leopard|A spotted big cat`,
    hard: `chimpanzee|One of our closest relatives among the apes
rhinoceros|A huge horned animal of Africa and Asia
hippopotamus|Its name means river horse
orangutan|A red-haired ape of Borneo and Sumatra
salamander|An amphibian that can regrow a lost limb
woodpecker|A bird that drums on tree trunks
porcupine|A rodent covered in sharp quills
armadillo|A mammal with armour that can curl into a ball
chameleon|A lizard famous for changing colour
platypus|A mammal that lays eggs and has a bill`,
  },
  countries: {
    easy: `japan|The land of the rising sun
china|Home of the Great Wall
italy|A country shaped like a boot
spain|The country of flamenco and paella
egypt|Land of the pyramids and the Nile
india|Home of the Taj Mahal
kenya|An East African country famous for safaris
cuba|A large island nation in the Caribbean
peru|Home of Machu Picchu
chile|A very long, thin country along the Andes`,
    medium: `germany|Berlin is its capital
brazil|Home of the Amazon rainforest and carnival
morocco|A North African country with Marrakesh
thailand|A Southeast Asian land of temples and elephants
portugal|Lisbon is its capital
ethiopia|The birthplace of coffee
colombia|Bogota is its capital
malaysia|Kuala Lumpur is its capital
pakistan|Islamabad is its capital
vietnam|Hanoi is its capital`,
    hard: `switzerland|Famous for neutrality, chocolate and watches
azerbaijan|A country on the Caspian Sea in the Caucasus
kazakhstan|The largest landlocked country in the world
madagascar|An island nation that is home to lemurs
bangladesh|Dhaka is its capital
luxembourg|A tiny grand duchy in Western Europe
mozambique|Maputo is its capital
afghanistan|Kabul is its capital
uzbekistan|Samarkand and Bukhara are cities here
liechtenstein|A tiny Alpine principality between Switzerland and Austria`,
  },
  food: {
    easy: `pizza|A round, cheesy dish from Italy
bread|Baked from flour and yeast
apple|A crunchy fruit that can be red or green
mango|A sweet tropical fruit
pasta|Spaghetti is one kind
salad|A bowl of mixed leaves and vegetables
honey|Made by bees
rice|Small grains eaten all over the world
cake|Often baked for a birthday
lemon|A sour yellow citrus fruit`,
    medium: `noodles|Long strands served in a bowl of broth
pancake|A flat round breakfast treat
avocado|A green fruit used to make guacamole
broccoli|A green vegetable shaped like a little tree
sandwich|A filling between two slices of bread
dumpling|A parcel of dough with a filling
burrito|A tortilla rolled around a filling
porridge|A hot oat breakfast
pretzel|A twisted, salty baked snack
biryani|A spiced dish of layered rice`,
    hard: `bruschetta|Toasted bread with a tomato topping
quesadilla|A folded tortilla with melted cheese
cappuccino|Coffee topped with frothy milk
croissant|A flaky, buttery French pastry
chimichurri|A green herb sauce from Argentina
worcestershire|An English sauce that is hard to spell
minestrone|A thick Italian vegetable soup
pistachio|A small green nut
guacamole|A dip made from mashed avocado
jalapeno|A medium-hot green chilli`,
  },
  technology: {
    easy: `phone|You can call and text with it
modem|Connects your home to the internet
email|A digital letter
robot|A machine that follows programs
pixel|A tiny dot of colour on a screen
wifi|Wireless internet
video|Moving pictures, often with sound
cable|Carries power or a signal
laptop|A portable computer
tablet|A flat touchscreen computer`,
    medium: `keyboard|You type on it
browser|Used to visit websites
password|A secret word that protects an account
internet|The global network of networks
software|Programs rather than physical parts
download|Copy a file from the web to your device
hardware|The physical parts of a computer
database|An organised collection of data
bluetooth|A short-range wireless link
username|The name you log in with`,
    hard: `algorithm|A step-by-step set of instructions
cybersecurity|Protecting systems from attacks
encryption|Scrambling data so only a key can unlock it
processor|The brain of a computer
microphone|Records sound
programming|Writing instructions for computers
bandwidth|How much data a connection can carry
touchscreen|A display you control with your fingers
smartphone|A pocket computer that makes calls
motherboard|The main circuit board of a computer`,
  },
  science: {
    easy: `atom|The smallest unit of an element
cell|The basic unit of life
star|Shines in the night sky
moon|Orbits the Earth
heat|Energy that makes things warm
light|Lets us see
force|A push or a pull
plant|Makes its own food from sunlight
earth|The planet we live on
water|Its formula is H2O`,
    medium: `gravity|Pulls things towards the ground
magnet|Attracts iron
oxygen|The gas we breathe
planet|A world that orbits a star
fossil|The preserved remains of ancient life
neutron|A particle with no charge in an atom's nucleus
microbe|A tiny living thing
electron|A negative particle that orbits the nucleus
molecule|Two or more atoms joined together
telescope|An instrument for looking at distant stars`,
    hard: `photosynthesis|How plants turn light into food
chromosome|Carries genes inside a cell
hypothesis|A testable explanation
metamorphosis|A caterpillar becomes a butterfly
thermometer|Measures temperature
evaporation|A liquid turning into a gas
acceleration|The rate at which speed changes
mitochondria|The powerhouse of the cell
spectrum|The range of colours in a rainbow
bacteria|Single-celled living things`,
  },
  movies: {
    easy: `shrek|A green ogre who lives in a swamp
frozen|Elsa sings Let It Go
cars|Talking racing vehicles
coco|A Pixar film about Day of the Dead music
bambi|A young deer in the forest
dumbo|An elephant with enormous ears
moana|A girl who sails across the Pacific
jaws|A shark thriller
tarzan|A boy raised by apes
mulan|A girl who joins the army in disguise`,
    medium: `titanic|A famous ship, an iceberg and a love story
gladiator|A Roman arena fighter seeks revenge
inception|A thriller set inside dreams
jumanji|A jungle board game comes to life
matilda|A bookish girl with special powers
aladdin|A street boy, a lamp and a genie
hercules|A Greek hero with great strength
spiderman|A hero who climbs walls
zootopia|A rabbit police officer and a fox
ironman|A billionaire in a flying suit`,
    hard: `casablanca|A classic wartime romance set in Morocco
ratatouille|A rat who dreams of cooking in Paris
ghostbusters|Who you gonna call?
pocahontas|A Disney heroine who paints with all the colours of the wind
interstellar|A space epic about wormholes
terminator|A cyborg who says he will be back
transformers|Robots in disguise
cinderella|A glass slipper and a midnight deadline
rapunzel|A princess with extremely long hair
braveheart|A Scottish rebel fights for freedom`,
  },
  sports: {
    easy: `golf|Played with clubs and a small ball in a hole
tennis|A racket sport played over a net
rugby|An oval ball and scrums
boxing|Gloves and a ring
hockey|Sticks and a puck or a ball
soccer|A round ball and two goals
judo|A Japanese martial art of throws
skiing|Sliding down snowy slopes
rowing|Pulling oars in a boat
surf|Riding waves on a board`,
    medium: `football|Called soccer in some countries
cricket|Bat, ball and wickets
baseball|Pitchers, batters and home runs
swimming|Freestyle and butterfly are strokes
archery|A bow and a target
athletics|Track and field
handball|Throw a ball into a goal with your hands
badminton|Played with a shuttlecock
wrestling|Grappling on a mat
cycling|Racing on two wheels`,
    hard: `gymnastics|Floor, beam and vault
basketball|Dribble and shoot at a hoop
snowboarding|One board strapped to both feet on snow
weightlifting|Snatch and clean and jerk
taekwondo|A Korean martial art of kicks
triathlon|Swim, bike and run
decathlon|Ten events over two days
equestrian|Sports with horses
orienteering|Finding your way with a map and compass
bobsleigh|Racing a sled down an ice track`,
  },
  general: {
    easy: `money|Coins and notes
music|Rhythm and melody
river|Flows towards the sea
clock|Tells the time
train|Runs on rails
piano|Has black and white keys
ocean|Salt water covering most of the Earth
queen|A female monarch
bridge|Carries a road over a river
house|A place to live`,
    medium: `alphabet|A to Z
calendar|Shows the days and months
language|English and Hindi are examples
library|A place to borrow books
museum|A place to see old and interesting objects
compass|Its needle points north
passport|A travel document
treasure|Pirates hunt for it
festival|A big celebration
kingdom|A land ruled by a king or queen`,
    hard: `encyclopedia|A reference book of knowledge
democracy|Government by the people
archipelago|A chain of islands
philosophy|The study of wisdom and big questions
architecture|The art of designing buildings
civilization|An advanced human society
imagination|The ability to picture new ideas
constitution|The basic laws of a country
parliament|Where laws are debated
entrepreneur|Someone who starts a business`,
  },
  nature: {
    easy: `tree|Has a trunk and leaves
rain|Falls from clouds
wind|Moving air
leaf|Green and grows on a branch
rock|A hard lump of mineral
sand|Found on beaches
snow|White flakes in winter
lake|Still water surrounded by land
moss|A soft green plant on stones
seed|Where a plant begins`,
    medium: `mountain|Higher than a hill
volcano|Erupts with lava
waterfall|Water dropping over a cliff
rainbow|Colours in the sky after rain
glacier|A slow river of ice
thunder|The rumble after lightning
meadow|A grassy field of wildflowers
canyon|A deep valley with steep sides
blossom|A flower on a tree
tornado|A spinning funnel of wind`,
    hard: `rainforest|A dense, wet tropical woodland
avalanche|Snow sliding down a mountain
earthquake|The ground shaking
hurricane|A giant tropical storm
stalactite|Hangs from the roof of a cave
ecosystem|Living things and their surroundings
thunderstorm|Lightning, thunder and heavy rain
savannah|Grassland with scattered trees
evergreen|Keeps its leaves all year
wilderness|Wild land untouched by people`,
  },
  history: {
    easy: `king|Wears a crown
rome|An ancient city of emperors
sword|A knight's blade
pirate|Sailed under a skull and crossbones
viking|A Norse sailor
castle|Home of knights
tomb|A burial place
empire|Many lands ruled together
knight|An armoured horseman
crown|Worn by a monarch`,
    medium: `pyramid|An Egyptian tomb
pharaoh|The ruler of ancient Egypt
samurai|A Japanese warrior
crusade|A medieval campaign for a holy cause
colony|Land settled by another country
parchment|An early writing material
dynasty|A family of rulers
conquest|Taking land by force
treaty|An agreement between nations
explorer|Sailed to find new lands`,
    hard: `renaissance|The rebirth of art and learning in Europe
independence|Freedom from outside rule
revolution|The overthrow of a government
archaeology|Studying the past by digging
mesopotamia|The land between two rivers
gunpowder|A Chinese invention that explodes
emancipation|Setting people free from slavery
constantinople|The old name of Istanbul
enlightenment|The Age of Reason
medieval|Belonging to the Middle Ages`,
  },
}

export type Entry = { word: string; clue: string }

const parse = (raw: string): Entry[] =>
  raw.split('\n').map((line) => {
    const [word, clue] = line.split('|')
    return { word: word.trim(), clue: clue.trim() }
  })

export const WORDS: Record<CategoryId, Record<Difficulty, Entry[]>> = Object.fromEntries(
  (Object.keys(RAW) as CategoryId[]).map((c) => [c, { easy: parse(RAW[c].easy), medium: parse(RAW[c].medium), hard: parse(RAW[c].hard) }]),
) as Record<CategoryId, Record<Difficulty, Entry[]>>

export const categoryTitle = (id: CategoryId) => CATEGORIES.find((c) => c[0] === id)?.[1] ?? id

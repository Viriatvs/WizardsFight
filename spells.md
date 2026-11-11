# Spells

The game picks a random spell from this file for each battle. The server reads it at startup, so after editing, restart `npm run dev` locally, or push to GitHub to deploy.

## How to edit

- Each `## Heading` is a category. The table under it lists that category's spells.
- One row per spell: `| Latin | English | Description |`.
- **Latin** is what players must type. Use only letters and spaces, with no commas, apostrophes or other punctuation. Capitalisation does not matter.
- Don't use the `|` character inside a cell.
- To add a category, add a new `## Heading` with a table under it.
- If a row is invalid, the server refuses to start and names the line.

## Fire

| Latin | English | Description |
|---|---|---|
| Ignis Aeternus Devora | Eternal fire devour | Creates a flame that burns until the caster dismisses it. |
| Flamma ex Ossibus Surgat | Let flame rise from the bones | Ignites the target from within. |
| Cinis ad Cinerem Redeat | Let ash return to ash | Reduces an object or creature to ash. |
| Sol Captivus in Manu Mea | A captive sun in my hand | Conjures an orb of sunfire held in the palm. |
| Pluvia Ignium Descendat | Let a rain of fires descend | Calls burning hail over a wide area. |
| Draco Flammarum Expergiscere | Dragon of flames awaken | Summons a serpent made of fire. |
| Murus Ardens Me Circumdet | Let a burning wall surround me | Raises a ring of fire around the caster. |
| Sanguis Meus Ignis Fiat | Let my blood become fire | Trades the caster’s health for massive damage. |
| Stella Cadens Terram Feriat | Let a falling star strike the earth | Calls down a meteor. |
| Ignis Fatuus Duc Eos in Errorem | Will-o-wisp lead them astray | Lures enemies off course with false lights. |

## Ice & Water

| Latin | English | Description |
|---|---|---|
| Cor Tuum in Glaciem Vertatur | May your heart turn to ice | Slowly freezes the target from the chest outward. |
| Hiems Perpetua Descendat | Let endless winter descend | Brings a permanent blizzard over a region. |
| Unda Maris Omnia Obruat | Let the sea’s wave overwhelm all | Summons a crushing tidal wave. |
| Speculum Glaciale Reddat Ictum | Let the ice mirror return the blow | Reflects an attack back at its source. |
| Aqua in Pulmonibus Tuis | Water in your lungs | A drowning curse that works on dry land. |
| Nix Silens Vestigia Tegat | Let silent snow cover the footprints | Erases all tracks behind the party. |
| Gladius Glacialis ex Nihilo | An ice sword from nothing | Forms a blade of unbreakable ice. |
| Vortex Abyssi Trahat | Let the vortex of the abyss drag | Opens a whirlpool that pulls targets under. |
| Ne Me Tangat Gelu Mortis | Let the frost of death not touch me | Grants immunity to cold. |
| Lacrimae Caeli Sanate | Tears of heaven heal | Brings a gentle rain that mends allies. |

## Storm & Air

| Latin | English | Description |
|---|---|---|
| Fulmen Iovis in Hostes Meos | Jupiter’s thunderbolt upon my enemies | Strikes enemies with a divine lightning bolt. |
| Ventus Septentrionalis Aufer Eos | North wind carry them away | Sweeps enemies off the battlefield. |
| Tempestas Ira Mea Est | The storm is my wrath | The weather grows worse as the caster grows angrier. |
| Catena Fulgurum Saliat | Let a chain of lightnings leap | Lightning jumps from target to target. |
| Aer Solidus Sub Pedibus Meis | Solid air beneath my feet | Lets the caster walk on air. |
| Tonitrus Aures Rumpat | Let thunder burst the ears | A deafening stunning blast. |
| Ala Venti Me Tollat | Let the wing of the wind lift me | Grants flight. |
| Silentium Aeris | Silence of the air | Creates a vacuum where there is no sound and no breath. |
| Oculus Procellae Me Tegat | Let the eye of the storm protect me | Creates a calm zone inside chaos. |
| Fulgur Rubrum e Nubibus Nigris | Red lightning from black clouds | Cursed lightning that leaves lasting wounds. |

## Earth & Stone

| Latin | English | Description |
|---|---|---|
| Terra Aperiatur et Deglutiat | Let the earth open and swallow | Opens a chasm beneath the target. |
| Caro in Lapidem Vertatur | Let flesh turn to stone | Petrifies the target. |
| Montes Surgite ad Vocem Meam | Mountains rise at my voice | Raises massive rock formations. |
| Custos ex Luto Formetur | Let a guardian be shaped from clay | Animates a clay golem. |
| Radices Antiquae Tenete Eos | Ancient roots hold them | Roots burst out of the ground and bind enemies. |
| Pellis Ferrea | Iron skin | Hardens the caster’s skin like armor. |
| Tremor Terrae Fundamenta Quatiat | Let the earthquake shake the foundations | Topples structures. |
| Aurum ex Plumbo | Gold from lead | Transmutation at a hidden cost. |
| Hastae Lapideae e Solo Surgant | Let stone spears rise from the ground | A field of spikes erupts. |
| Vox Saxorum Loquere Mihi | Voice of the stones speak to me | The stones reveal what happened in this place. |

## Light & Protection

| Latin | English | Description |
|---|---|---|
| Lux in Tenebris Lucet | Light shines in the darkness | Banishes all magical darkness. |
| Scutum Fidei Impenetrabile | Impenetrable shield of faith | Creates a barrier whose strength depends on the caster’s conviction. |
| Radius Solis Purgantis | Ray of the purifying sun | A beam that burns the undead and corruption. |
| Oculus Veritatis Aperiatur | Let the eye of truth be opened | Reveals invisible and disguised things. |
| Corona Stellarum Me Protegat | Let a crown of stars protect me | Orbiting stars intercept attacks. |
| Sigillum Lucis Hanc Portam Claudat | Let the seal of light close this gate | Permanently seals a portal. |
| Malum Hic Non Intrabit | Evil shall not enter here | A ward over a dwelling. |
| Ignis Sanctus Daemones Expellat | Let holy fire expel the demons | An exorcism. |
| Dies Media in Nocte | Midday in the night | Brings noon briefly at midnight. |
| Angele Custos Descende | Guardian angel descend | Summons a celestial protector. |

## Shadow & Darkness

| Latin | English | Description |
|---|---|---|
| Umbra Mea Surge et Pugna | My shadow rise and fight | The caster’s shadow becomes a warrior. |
| Nox Aeterna Oculos Claudat | Let eternal night close the eyes | Blinds the target. |
| Per Umbras Ambulo | I walk through shadows | Teleports the caster from shadow to shadow. |
| Velum Tenebrarum | Veil of darkness | Grants invisibility in dim light. |
| Abyssus Abyssum Invocat | The deep calls to the deep | Summons a horror from the void. |
| Lux Tua Mea Fiat | Let your light become mine | Steals the target’s vitality. |
| Nomen Tuum Oblivioni Trado | I hand your name over to oblivion | Everyone forgets the target exists. |
| Fauces Noctis Devorent | Let the jaws of night devour | Darkness consumes the target. |
| Umbrae Mortuorum Susurrent | Let the shades of the dead whisper | Ghostly voices reveal secrets. |
| Sine Lumine Sine Spe | Without light without hope | An aura of despair that weakens enemies. |

## Life & Healing

| Latin | English | Description |
|---|---|---|
| Vulnera Claudantur Sanguis Sistatur | Let wounds close let blood stop | Heals the target instantly. |
| Vita ex Morte Mea | Life from my death | The caster dies to revive an ally. |
| Floreat Terra Deserta | Let the barren earth bloom | Restores dead land. |
| Venenum in Aquam Mutetur | Let poison be changed into water | Cures all toxins. |
| Cor Leonis Tibi Do | I give you the heart of a lion | Grants courage and strength. |
| Somnus Sanans | Healing sleep | Deep restorative rest. |
| Anima Redi in Corpus Tuum | Soul return to your body | Resurrection. |
| Arbor Vitae Radices Mittat | Let the Tree of Life put down roots | Creates a healing zone. |
| Ossa Fracta Iterum Coniungantur | Let broken bones be joined again | Mends fractures. |
| Spiritus Meus Tecum | My spirit is with you | Links the caster’s life force to an ally’s. |

## Death & Necromancy

| Latin | English | Description |
|---|---|---|
| Mortui Surgite et Servite | Dead rise and serve | Raises the dead as servants. |
| Memento Mori | Remember that you will die | Shows the target a vision of their own death and fills them with terror. |
| Vita Tua Mea Vita | Your life my life | Drains the target’s life. |
| Porta Inferorum Aperiatur | Let the gate of the underworld open | Opens a portal to the realm of the dead. |
| Charon Accipe Obolum | Charon accept the coin | Ferries a soul away and banishes it instantly. |
| Carnes Putrescant | Let the flesh rot | A decay curse. |
| Legio Ossium | Legion of bones | Summons a skeleton army. |
| Ultimum Verbum Mortui | The last word of the dead | Lets the caster question a corpse. |
| Falx Messoris | Scythe of the Reaper | A spectral scythe that cuts souls. |
| Mors Non Est Finis | Death is not the end | The caster returns from death once. |

## Mind & Illusion

| Latin | English | Description |
|---|---|---|
| Mens Tua in Manu Mea | Your mind is in my hand | Domination. |
| Quod Vides Non Est | What you see is not | A full illusion. |
| Oblivio Dulcis | Sweet oblivion | Erases memories. |
| Mille Facies Mihi | A thousand faces for me | Lets the caster take any appearance. |
| Vox Mea in Capite Tuo | My voice in your head | Telepathy. |
| Somnium Sine Fine | A dream without end | Puts the target into eternal sleep. |
| Timor Tuus Carnem Induat | Let your fear put on flesh | Makes the target’s fears physically manifest. |
| Veritas ex Ore Tuo Fluat | Let truth flow from your mouth | Compels the target to tell the truth. |
| Speculum Animae | Mirror of the soul | Reveals a person’s true nature. |
| Insania Contagiosa | Contagious madness | Spreads madness from person to person. |

## Time Space & Fate

| Latin | English | Description |
|---|---|---|
| Tempus Siste | Time stand still | Freezes time. |
| Hora Retro Fluat | Let the hour flow backward | Rewinds recent events. |
| Hic et Ubique | Here and everywhere | Lets the caster exist in several places at once. |
| Porta Inter Mundos | Gate between worlds | A planar portal. |
| Fila Fati Incido | I cut the threads of fate | Undoes a destined outcome. |
| Spatium Plicetur | Let space be folded | Long-range teleportation. |
| Videam Quod Erit | May I see what will be | Prophecy. |
| Celeritas Mercurii | The speed of Mercury | Haste. |
| Senectus Momento | Old age in an instant | Ages the target decades in a moment. |
| Finis Omnium Rerum | The end of all things | The forbidden final spell. |

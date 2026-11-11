export interface Spell {
  latin: string;
  english: string;
  description: string;
  category: string;
}

const SPELLS: Spell[] = [
  { latin: 'Ignis Aeternus Devora', english: 'Eternal fire devour', category: 'Fire', description: 'Creates a flame that burns until the caster dismisses it.' },
  { latin: 'Flamma ex Ossibus Surgat', english: 'Let flame rise from the bones', category: 'Fire', description: 'Ignites the target from within.' },
  { latin: 'Cinis ad Cinerem Redeat', english: 'Let ash return to ash', category: 'Fire', description: 'Reduces an object or creature to ash.' },
  { latin: 'Sol Captivus in Manu Mea', english: 'A captive sun in my hand', category: 'Fire', description: 'Conjures an orb of sunfire held in the palm.' },
  { latin: 'Pluvia Ignium Descendat', english: 'Let a rain of fires descend', category: 'Fire', description: 'Calls burning hail over a wide area.' },
  { latin: 'Draco Flammarum Expergiscere', english: 'Dragon of flames awaken', category: 'Fire', description: 'Summons a serpent made of fire.' },
  { latin: 'Murus Ardens Me Circumdet', english: 'Let a burning wall surround me', category: 'Fire', description: 'Raises a ring of fire around the caster.' },
  { latin: 'Sanguis Meus Ignis Fiat', english: 'Let my blood become fire', category: 'Fire', description: 'Trades the caster\u2019s health for massive damage.' },
  { latin: 'Stella Cadens Terram Feriat', english: 'Let a falling star strike the earth', category: 'Fire', description: 'Calls down a meteor.' },
  { latin: 'Ignis Fatuus Duc Eos in Errorem', english: 'Will-o-wisp lead them astray', category: 'Fire', description: 'Lures enemies off course with false lights.' },

  { latin: 'Cor Tuum in Glaciem Vertatur', english: 'May your heart turn to ice', category: 'Ice & Water', description: 'Slowly freezes the target from the chest outward.' },
  { latin: 'Hiems Perpetua Descendat', english: 'Let endless winter descend', category: 'Ice & Water', description: 'Brings a permanent blizzard over a region.' },
  { latin: 'Unda Maris Omnia Obruat', english: 'Let the sea\u2019s wave overwhelm all', category: 'Ice & Water', description: 'Summons a crushing tidal wave.' },
  { latin: 'Speculum Glaciale Reddat Ictum', english: 'Let the ice mirror return the blow', category: 'Ice & Water', description: 'Reflects an attack back at its source.' },
  { latin: 'Aqua in Pulmonibus Tuis', english: 'Water in your lungs', category: 'Ice & Water', description: 'A drowning curse that works on dry land.' },
  { latin: 'Nix Silens Vestigia Tegat', english: 'Let silent snow cover the footprints', category: 'Ice & Water', description: 'Erases all tracks behind the party.' },
  { latin: 'Gladius Glacialis ex Nihilo', english: 'An ice sword from nothing', category: 'Ice & Water', description: 'Forms a blade of unbreakable ice.' },
  { latin: 'Vortex Abyssi Trahat', english: 'Let the vortex of the abyss drag', category: 'Ice & Water', description: 'Opens a whirlpool that pulls targets under.' },
  { latin: 'Ne Me Tangat Gelu Mortis', english: 'Let the frost of death not touch me', category: 'Ice & Water', description: 'Grants immunity to cold.' },
  { latin: 'Lacrimae Caeli Sanate', english: 'Tears of heaven heal', category: 'Ice & Water', description: 'Brings a gentle rain that mends allies.' },

  { latin: 'Fulmen Iovis in Hostes Meos', english: 'Jupiter\u2019s thunderbolt upon my enemies', category: 'Storm & Air', description: 'Strikes enemies with a divine lightning bolt.' },
  { latin: 'Ventus Septentrionalis Aufer Eos', english: 'North wind carry them away', category: 'Storm & Air', description: 'Sweeps enemies off the battlefield.' },
  { latin: 'Tempestas Ira Mea Est', english: 'The storm is my wrath', category: 'Storm & Air', description: 'The weather grows worse as the caster grows angrier.' },
  { latin: 'Catena Fulgurum Saliat', english: 'Let a chain of lightnings leap', category: 'Storm & Air', description: 'Lightning jumps from target to target.' },
  { latin: 'Aer Solidus Sub Pedibus Meis', english: 'Solid air beneath my feet', category: 'Storm & Air', description: 'Lets the caster walk on air.' },
  { latin: 'Tonitrus Aures Rumpat', english: 'Let thunder burst the ears', category: 'Storm & Air', description: 'A deafening stunning blast.' },
  { latin: 'Ala Venti Me Tollat', english: 'Let the wing of the wind lift me', category: 'Storm & Air', description: 'Grants flight.' },
  { latin: 'Silentium Aeris', english: 'Silence of the air', category: 'Storm & Air', description: 'Creates a vacuum where there is no sound and no breath.' },
  { latin: 'Oculus Procellae Me Tegat', english: 'Let the eye of the storm protect me', category: 'Storm & Air', description: 'Creates a calm zone inside chaos.' },
  { latin: 'Fulgur Rubrum e Nubibus Nigris', english: 'Red lightning from black clouds', category: 'Storm & Air', description: 'Cursed lightning that leaves lasting wounds.' },

  { latin: 'Terra Aperiatur et Deglutiat', english: 'Let the earth open and swallow', category: 'Earth & Stone', description: 'Opens a chasm beneath the target.' },
  { latin: 'Caro in Lapidem Vertatur', english: 'Let flesh turn to stone', category: 'Earth & Stone', description: 'Petrifies the target.' },
  { latin: 'Montes Surgite ad Vocem Meam', english: 'Mountains rise at my voice', category: 'Earth & Stone', description: 'Raises massive rock formations.' },
  { latin: 'Custos ex Luto Formetur', english: 'Let a guardian be shaped from clay', category: 'Earth & Stone', description: 'Animates a clay golem.' },
  { latin: 'Radices Antiquae Tenete Eos', english: 'Ancient roots hold them', category: 'Earth & Stone', description: 'Roots burst out of the ground and bind enemies.' },
  { latin: 'Pellis Ferrea', english: 'Iron skin', category: 'Earth & Stone', description: 'Hardens the caster\u2019s skin like armor.' },
  { latin: 'Tremor Terrae Fundamenta Quatiat', english: 'Let the earthquake shake the foundations', category: 'Earth & Stone', description: 'Topples structures.' },
  { latin: 'Aurum ex Plumbo', english: 'Gold from lead', category: 'Earth & Stone', description: 'Transmutation at a hidden cost.' },
  { latin: 'Hastae Lapideae e Solo Surgant', english: 'Let stone spears rise from the ground', category: 'Earth & Stone', description: 'A field of spikes erupts.' },
  { latin: 'Vox Saxorum Loquere Mihi', english: 'Voice of the stones speak to me', category: 'Earth & Stone', description: 'The stones reveal what happened in this place.' },

  { latin: 'Lux in Tenebris Lucet', english: 'Light shines in the darkness', category: 'Light & Protection', description: 'Banishes all magical darkness.' },
  { latin: 'Scutum Fidei Impenetrabile', english: 'Impenetrable shield of faith', category: 'Light & Protection', description: 'Creates a barrier whose strength depends on the caster\u2019s conviction.' },
  { latin: 'Radius Solis Purgantis', english: 'Ray of the purifying sun', category: 'Light & Protection', description: 'A beam that burns the undead and corruption.' },
  { latin: 'Oculus Veritatis Aperiatur', english: 'Let the eye of truth be opened', category: 'Light & Protection', description: 'Reveals invisible and disguised things.' },
  { latin: 'Corona Stellarum Me Protegat', english: 'Let a crown of stars protect me', category: 'Light & Protection', description: 'Orbiting stars intercept attacks.' },
  { latin: 'Sigillum Lucis Hanc Portam Claudat', english: 'Let the seal of light close this gate', category: 'Light & Protection', description: 'Permanently seals a portal.' },
  { latin: 'Malum Hic Non Intrabit', english: 'Evil shall not enter here', category: 'Light & Protection', description: 'A ward over a dwelling.' },
  { latin: 'Ignis Sanctus Daemones Expellat', english: 'Let holy fire expel the demons', category: 'Light & Protection', description: 'An exorcism.' },
  { latin: 'Dies Media in Nocte', english: 'Midday in the night', category: 'Light & Protection', description: 'Brings noon briefly at midnight.' },
  { latin: 'Angele Custos Descende', english: 'Guardian angel descend', category: 'Light & Protection', description: 'Summons a celestial protector.' },

  { latin: 'Umbra Mea Surge et Pugna', english: 'My shadow rise and fight', category: 'Shadow & Darkness', description: 'The caster\u2019s shadow becomes a warrior.' },
  { latin: 'Nox Aeterna Oculos Claudat', english: 'Let eternal night close the eyes', category: 'Shadow & Darkness', description: 'Blinds the target.' },
  { latin: 'Per Umbras Ambulo', english: 'I walk through shadows', category: 'Shadow & Darkness', description: 'Teleports the caster from shadow to shadow.' },
  { latin: 'Velum Tenebrarum', english: 'Veil of darkness', category: 'Shadow & Darkness', description: 'Grants invisibility in dim light.' },
  { latin: 'Abyssus Abyssum Invocat', english: 'The deep calls to the deep', category: 'Shadow & Darkness', description: 'Summons a horror from the void.' },
  { latin: 'Lux Tua Mea Fiat', english: 'Let your light become mine', category: 'Shadow & Darkness', description: 'Steals the target\u2019s vitality.' },
  { latin: 'Nomen Tuum Oblivioni Trado', english: 'I hand your name over to oblivion', category: 'Shadow & Darkness', description: 'Everyone forgets the target exists.' },
  { latin: 'Fauces Noctis Devorent', english: 'Let the jaws of night devour', category: 'Shadow & Darkness', description: 'Darkness consumes the target.' },
  { latin: 'Umbrae Mortuorum Susurrent', english: 'Let the shades of the dead whisper', category: 'Shadow & Darkness', description: 'Ghostly voices reveal secrets.' },
  { latin: 'Sine Lumine Sine Spe', english: 'Without light without hope', category: 'Shadow & Darkness', description: 'An aura of despair that weakens enemies.' },

  { latin: 'Vulnera Claudantur Sanguis Sistatur', english: 'Let wounds close let blood stop', category: 'Life & Healing', description: 'Heals the target instantly.' },
  { latin: 'Vita ex Morte Mea', english: 'Life from my death', category: 'Life & Healing', description: 'The caster dies to revive an ally.' },
  { latin: 'Floreat Terra Deserta', english: 'Let the barren earth bloom', category: 'Life & Healing', description: 'Restores dead land.' },
  { latin: 'Venenum in Aquam Mutetur', english: 'Let poison be changed into water', category: 'Life & Healing', description: 'Cures all toxins.' },
  { latin: 'Cor Leonis Tibi Do', english: 'I give you the heart of a lion', category: 'Life & Healing', description: 'Grants courage and strength.' },
  { latin: 'Somnus Sanans', english: 'Healing sleep', category: 'Life & Healing', description: 'Deep restorative rest.' },
  { latin: 'Anima Redi in Corpus Tuum', english: 'Soul return to your body', category: 'Life & Healing', description: 'Resurrection.' },
  { latin: 'Arbor Vitae Radices Mittat', english: 'Let the Tree of Life put down roots', category: 'Life & Healing', description: 'Creates a healing zone.' },
  { latin: 'Ossa Fracta Iterum Coniungantur', english: 'Let broken bones be joined again', category: 'Life & Healing', description: 'Mends fractures.' },
  { latin: 'Spiritus Meus Tecum', english: 'My spirit is with you', category: 'Life & Healing', description: 'Links the caster\u2019s life force to an ally\u2019s.' },

  { latin: 'Mortui Surgite et Servite', english: 'Dead rise and serve', category: 'Death & Necromancy', description: 'Raises the dead as servants.' },
  { latin: 'Memento Mori', english: 'Remember that you will die', category: 'Death & Necromancy', description: 'Shows the target a vision of their own death and fills them with terror.' },
  { latin: 'Vita Tua Mea Vita', english: 'Your life my life', category: 'Death & Necromancy', description: 'Drains the target\u2019s life.' },
  { latin: 'Porta Inferorum Aperiatur', english: 'Let the gate of the underworld open', category: 'Death & Necromancy', description: 'Opens a portal to the realm of the dead.' },
  { latin: 'Charon Accipe Obolum', english: 'Charon accept the coin', category: 'Death & Necromancy', description: 'Ferries a soul away and banishes it instantly.' },
  { latin: 'Carnes Putrescant', english: 'Let the flesh rot', category: 'Death & Necromancy', description: 'A decay curse.' },
  { latin: 'Legio Ossium', english: 'Legion of bones', category: 'Death & Necromancy', description: 'Summons a skeleton army.' },
  { latin: 'Ultimum Verbum Mortui', english: 'The last word of the dead', category: 'Death & Necromancy', description: 'Lets the caster question a corpse.' },
  { latin: 'Falx Messoris', english: 'Scythe of the Reaper', category: 'Death & Necromancy', description: 'A spectral scythe that cuts souls.' },
  { latin: 'Mors Non Est Finis', english: 'Death is not the end', category: 'Death & Necromancy', description: 'The caster returns from death once.' },

  { latin: 'Mens Tua in Manu Mea', english: 'Your mind is in my hand', category: 'Mind & Illusion', description: 'Domination.' },
  { latin: 'Quod Vides Non Est', english: 'What you see is not', category: 'Mind & Illusion', description: 'A full illusion.' },
  { latin: 'Oblivio Dulcis', english: 'Sweet oblivion', category: 'Mind & Illusion', description: 'Erases memories.' },
  { latin: 'Mille Facies Mihi', english: 'A thousand faces for me', category: 'Mind & Illusion', description: 'Lets the caster take any appearance.' },
  { latin: 'Vox Mea in Capite Tuo', english: 'My voice in your head', category: 'Mind & Illusion', description: 'Telepathy.' },
  { latin: 'Somnium Sine Fine', english: 'A dream without end', category: 'Mind & Illusion', description: 'Puts the target into eternal sleep.' },
  { latin: 'Timor Tuus Carnem Induat', english: 'Let your fear put on flesh', category: 'Mind & Illusion', description: 'Makes the target\u2019s fears physically manifest.' },
  { latin: 'Veritas ex Ore Tuo Fluat', english: 'Let truth flow from your mouth', category: 'Mind & Illusion', description: 'Compels the target to tell the truth.' },
  { latin: 'Speculum Animae', english: 'Mirror of the soul', category: 'Mind & Illusion', description: 'Reveals a person\u2019s true nature.' },
  { latin: 'Insania Contagiosa', english: 'Contagious madness', category: 'Mind & Illusion', description: 'Spreads madness from person to person.' },

  { latin: 'Tempus Siste', english: 'Time stand still', category: 'Time Space & Fate', description: 'Freezes time.' },
  { latin: 'Hora Retro Fluat', english: 'Let the hour flow backward', category: 'Time Space & Fate', description: 'Rewinds recent events.' },
  { latin: 'Hic et Ubique', english: 'Here and everywhere', category: 'Time Space & Fate', description: 'Lets the caster exist in several places at once.' },
  { latin: 'Porta Inter Mundos', english: 'Gate between worlds', category: 'Time Space & Fate', description: 'A planar portal.' },
  { latin: 'Fila Fati Incido', english: 'I cut the threads of fate', category: 'Time Space & Fate', description: 'Undoes a destined outcome.' },
  { latin: 'Spatium Plicetur', english: 'Let space be folded', category: 'Time Space & Fate', description: 'Long-range teleportation.' },
  { latin: 'Videam Quod Erit', english: 'May I see what will be', category: 'Time Space & Fate', description: 'Prophecy.' },
  { latin: 'Celeritas Mercurii', english: 'The speed of Mercury', category: 'Time Space & Fate', description: 'Haste.' },
  { latin: 'Senectus Momento', english: 'Old age in an instant', category: 'Time Space & Fate', description: 'Ages the target decades in a moment.' },
  { latin: 'Finis Omnium Rerum', english: 'The end of all things', category: 'Time Space & Fate', description: 'The forbidden final spell.' },
];

export { SPELLS };

export function randomSpell(excludeLatin?: string): Spell {
  const available = excludeLatin ? SPELLS.filter((s) => s.latin !== excludeLatin) : SPELLS;
  return available[Math.floor(Math.random() * available.length)];
}

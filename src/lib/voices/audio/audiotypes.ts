

  export enum Genre {
    hiphop = "hiphop",
    trap = "trap",
    rnb = "rnb",
    pop = "pop",
    rock = "rock",
    jazz = "jazz",
    soul = "soul",
    funk = "funk",
    electronic = "electronic",
    experimental = "experimental",
    world = "world",
    fx = "fx"

}
export type SoundListProps = {
    items: Sample[];
    drumType?: Drum | undefined;
    lastEvaluatedKey?: string;
  };
export enum DrumMachine {
    // "01w-drums",
    // "505-707-727",
    // "Alesis-HR16b",
    // "Boss-DR-110-DrRhythm",
    // "bossdr55",
    // "CasioSK-1",
    // "CasioVL-1",
    // "CR68-MSXKit",
    // "cr78-ma101",
    // "CrashCymbals",
    // "D70Drums",
    // "ddd1-kpr77",
    // "Dr550",
    // "Drumulator",
    // "emu_sp12",
    // "KAWAI-R-50e",
    // "korgmini",
    // "kpr77-ddm",
    // "kr33",
    // "Kr55b",
    // "linn9000",
    // "oberheim",
    // "OberhiemDMX- LN2-TOM",
    // "R8Drums",
    // "Roland-Cr-78",
    // "Roland-DR55-110-220",
    // "RolandDR-550mkII",
    tr808 = "tr808",
    tr909 = "tr909",
    tr707 = "tr707",
    tr606 = "tr606",
    tr505 = "tr505",
    AlesisHR16b = "AlesisHR16b",
    BossDR110DrRhythm = "BossDR110DrRhythm",
    bossdr55 = "bossdr55",
    CasioSK1 = "CasioSK1",
    CasioVL1 = "CasioVL1",
    CR68MSXKit = "CR68MSXKit",
    cr78ma101 = "cr78ma101",
    D70Drums = "D70Drums",
    ddd1kpr77 = "ddd1kpr77",
    Dr550 = "Dr550",
    Drumulator = "Drumulator",
    emu_sp12 = "emu_sp12",
    KAWAIR50e = "KAWAIR50e",
    korgmini = "korgmini",
    kpr77ddm = "kpr77ddm",
    kr33 = "kr33",
    Kr55b = "Kr55b",
    linn9000 = "linn9000",
    oberheim = "oberheim",
    OberhiemDMXLN2TOM = "OberhiemDMXLN2TOM",
    R8Drums = "R8Drums",
    RolandCr78 = "RolandCr78",
    RolandDR55110220 = "RolandDR55110220",
    RolandDR550mkII = "RolandDR550mkII",
    // "RolandTR-505",
    
}
    

export enum Drum {
    sub = "sub",
    kick = "kick",
    snare = "snare",
    ohat = "ohat",
    chat = "chat",
    cymbal = "cymbal",
    tom = "tom",
    perc = "perc",
    shaker = "shaker",
    clave = "clave",
    stick = "stick",
    bell = "bell",
    conga = "conga",
    whistle = "whistle",
    femvox = "femvox",
    malevox = "malevox",
    tam = "tam",
    fx = "fx",
    clap = "clap",
    ride = "ride",
    rim = "rim",
    nome = "nome",
    loop = "loop",
    sample = "sample"
}
export enum Hygiene {
    clean = "clean",
    dirty = "dirty"
}
export enum Length {
    short = "short",
    mid = "mid",
    long = "long"
}
export enum PitchRange {
    low = "low",
    mid = "mid",
    high = "high"
}
export enum Mix {
    dry = "dry",
    wet = "wet"
}
export enum Loudness {
    soft = "soft",
    mid = "mid",
    loud = "loud"
}
export enum DecadeStyle {
    fifties = "fifties",
    sixties = "sixties",
    seventies = "seventies",
    eighties = "eighties",
    nineties = "nineties",
    twothousands = "twothousands",
    tens = "tens",
    twenties = "twenties",
    thirties = "thirties",
    spaceage = "spaceage"
}
export enum SourceGen1 {
    analog = "analog",
    digital = "digital"
}
export enum SourceGen2 {
    organic = "organic",
    synthetic = "synthetic"
}
export type Tag = string;
export type SampleType = {
    name: string,
    s3Path: string,
    description?: string,
    genre?: Genre[],
    tags?: Tag[],
    drum?: Drum,
    hygiene?: Hygiene,
    length?: Length,
    pitchRange?: PitchRange,
    mix?: Mix,
    loudness?: Loudness,
    decadeStyle?: DecadeStyle,
    sourceGen1?: SourceGen1,
    sourceGen2?: SourceGen2,
    drumMachine: DrumMachine,
    reversed?: boolean,
    owner?: string,
    

}

export interface Sample {
   
    name: string,
    s3Path: string,
    description?: string,
    genre?: Genre,
    tags?: Tag[],
    drum?: Drum,
    hygiene?: Hygiene,
    length?: Length,
    pitchRange?: PitchRange,
    mix?: Mix,
    loudness?: Loudness,
    decadeStyle?: DecadeStyle,
    sourceGen1?: SourceGen1,
    sourceGen2?: SourceGen2,
    drumMachine?: DrumMachine,
    reversed?: boolean,
    invalid?: boolean,
    owner?: string,
    id?: number | string
}


// Authored-board survival fixtures verified against unmodified hazards.
// Lowercase: direction; uppercase: activate a charge then turn; dot: brake/wait.
export const REPLAYS=Object.freeze([
  "rrrrddddrrrlllddrrddlllrddrrrrrruurllluurruuuuuurrrr",
  "rrrlllddrrddllddddddrrrruurrrrrrddrrrruuuuuulluurruulllrrr",
  "rrrrrrrrrldddDlllllluullddddrrddllrrddrrrruurrddrrrruurrlluurruuuuuul",
  "rrrlllddddddddrrrrrruurrddrrdDlllrrruurrrruuuuuuuulllrrr",
  "rrrrddrRrrddrluullddlllluullddddddrrddrrrrrrrrrruurruuuuuuuulllrrr",
  "rrrld...dlldddddddduurrrruuuurrrrrrddddRrrrdduuuuuuuuuulllrrr",
  "rrrlllddddddddrrrlddrrrruurrrrRrrruuuuuuuulllrrr",
  "rrrlddllddddddrrrlllddrrrrrrrrrrRrrruulllrrruuuuuulluulrrr",
  "rrrrrrddllddddlluulldddddduurrrrrrrRrrrrrrdduuuuuuuuuullddlllrrruulrrr",
  "rrrlddlldddddddduurrrruurRuullrrrrrrllddrrddrrrrdduuuuuuuuuulllrrr"
]);
export function decodeReplay(value){const directions={u:'up',r:'right',d:'down',l:'left'};return [...value].map(c=>({direction:directions[c.toLowerCase()]||null,cloak:c==='!'||/[URDL]/.test(c)}));}

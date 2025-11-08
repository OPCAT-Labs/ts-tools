import cat20ClosedMinter from '../../artifacts/cat20/minters/cat20ClosedMinter.json'
import cat20OpenMinter from '../../artifacts/cat20/minters/cat20OpenMinter.json'
import cat20 from '../../artifacts/cat20/cat20.json'
import cat20Guard_6_6_2 from '../../artifacts/cat20/cat20Guard_6_6_2.json'
import cat20Guard_6_6_4 from '../../artifacts/cat20/cat20Guard_6_6_4.json'
import cat20Guard_12_12_2 from '../../artifacts/cat20/cat20Guard_12_12_2.json'
import cat20Guard_12_12_4 from '../../artifacts/cat20/cat20Guard_12_12_4.json'
import cat721ClosedMinter from '../../artifacts/cat721/minters/cat721ClosedMinter.json'
import cat721OpenMinter from '../../artifacts/cat721/minters/cat721OpenMinter.json'
import cat721 from '../../artifacts/cat721/cat721.json'
import cat721Guard_6_6_2 from '../../artifacts/cat721/cat721Guard_6_6_2.json'
import cat721Guard_6_6_4 from '../../artifacts/cat721/cat721Guard_6_6_4.json'
import cat721Guard_12_12_2 from '../../artifacts/cat721/cat721Guard_12_12_2.json'
import cat721Guard_12_12_4 from '../../artifacts/cat721/cat721Guard_12_12_4.json'
import cat721StateLib from '../../artifacts/cat721/cat721StateLib.json'
import cat721GuardStateLib from '../../artifacts/cat721/cat721GuardStateLib.json'
import cat20StateLib from '../../artifacts/cat20/cat20StateLib.json'
import cat20GuardStateLib from '../../artifacts/cat20/cat20GuardStateLib.json'
import constants from '../../artifacts/constants.json'
import cat721OpenMintInfo from '../../artifacts/cat721/minters/cat721OpenMintInfo.json'

import { CAT20ClosedMinter } from '../contracts/cat20/minters/cat20ClosedMinter'
import { CAT20 } from '../contracts/cat20/cat20'
import { CAT20Guard_6_6_2 } from '../contracts/cat20/cat20Guard_6_6_2'
import { CAT20Guard_6_6_4 } from '../contracts/cat20/cat20Guard_6_6_4'
import { CAT20Guard_12_12_2 } from '../contracts/cat20/cat20Guard_12_12_2'
import { CAT20Guard_12_12_4 } from '../contracts/cat20/cat20Guard_12_12_4'
import { CAT20OpenMinter } from '../contracts/cat20/minters/cat20OpenMinter'
import { CAT20StateLib } from '../contracts/cat20/cat20StateLib'
import { CAT20GuardStateLib } from '../contracts/cat20/cat20GuardStateLib'
import { ConstantsLib } from '../contracts/constants'

import { CAT721ClosedMinter } from '../contracts/cat721/minters/cat721ClosedMinter'
import { CAT721OpenMinter } from '../contracts/cat721/minters/cat721OpenMinter'
import { CAT721 } from '../contracts/cat721/cat721'
import { CAT721Guard_6_6_2 } from '../contracts/cat721/cat721Guard_6_6_2'
import { CAT721Guard_6_6_4 } from '../contracts/cat721/cat721Guard_6_6_4'
import { CAT721Guard_12_12_2 } from '../contracts/cat721/cat721Guard_12_12_2'
import { CAT721Guard_12_12_4 } from '../contracts/cat721/cat721Guard_12_12_4'
import { CAT721StateLib } from '../contracts/cat721/cat721StateLib'
import { CAT721GuardStateLib } from '../contracts/cat721/cat721GuardStateLib'
import { CAT721OpenMintInfo } from '../contracts/cat721/minters/cat721OpenMintInfo'

export function loadAllArtifacts() {
  // CAT20
  CAT20ClosedMinter.loadArtifact(cat20ClosedMinter)
  CAT20OpenMinter.loadArtifact(cat20OpenMinter)
  CAT20.loadArtifact(cat20)
  CAT20Guard_6_6_2.loadArtifact(cat20Guard_6_6_2)
  CAT20Guard_6_6_4.loadArtifact(cat20Guard_6_6_4)
  CAT20Guard_12_12_2.loadArtifact(cat20Guard_12_12_2)
  CAT20Guard_12_12_4.loadArtifact(cat20Guard_12_12_4)
  CAT20StateLib.loadArtifact(cat20StateLib)
  CAT20GuardStateLib.loadArtifact(cat20GuardStateLib)
  ConstantsLib.loadArtifact(constants)
  // CAT721
  CAT721ClosedMinter.loadArtifact(cat721ClosedMinter)
  CAT721OpenMinter.loadArtifact(cat721OpenMinter)
  CAT721OpenMintInfo.loadArtifact(cat721OpenMintInfo)
  CAT721.loadArtifact(cat721)
  CAT721Guard_6_6_2.loadArtifact(cat721Guard_6_6_2)
  CAT721Guard_6_6_4.loadArtifact(cat721Guard_6_6_4)
  CAT721Guard_12_12_2.loadArtifact(cat721Guard_12_12_2)
  CAT721Guard_12_12_4.loadArtifact(cat721Guard_12_12_4)
  CAT721StateLib.loadArtifact(cat721StateLib)
  CAT721GuardStateLib.loadArtifact(cat721GuardStateLib)
}

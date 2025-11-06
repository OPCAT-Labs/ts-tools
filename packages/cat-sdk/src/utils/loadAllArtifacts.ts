import cat20ClosedMinter from '../../artifacts/cat20/minters/cat20ClosedMinter.json'
import cat20OpenMinter from '../../artifacts/cat20/minters/cat20OpenMinter.json'
import cat20 from '../../artifacts/cat20/cat20.json'
import cat20Guard from '../../artifacts/cat20/cat20Guard.json'
import cat20StateLib from '../../artifacts/cat20/cat20StateLib.json'
import cat20GuardStateLib from '../../artifacts/cat20/cat20GuardStateLib.json'
import constants from '../../artifacts/constants.json'
import cat20OpenMinterMetadata from '../../artifacts/cat20/minters/cat20OpenMinterMetadata.json'
import cat20ClosedMinterMetadata from '../../artifacts/cat20/minters/cat20ClosedMinterMetadata.json'

import { CAT20ClosedMinter } from '../contracts/cat20/minters/cat20ClosedMinter'
import { CAT20 } from '../contracts/cat20/cat20'
import { CAT20Guard } from '../contracts/cat20/cat20Guard'
import { CAT20OpenMinter } from '../contracts/cat20/minters/cat20OpenMinter'
import { CAT20StateLib } from '../contracts/cat20/cat20StateLib'
import { CAT20GuardStateLib } from '../contracts/cat20/cat20GuardStateLib'
import { ConstantsLib } from '../contracts/constants'
import {
  CAT20ClosedMinterMetadata,
  CAT20OpenMinterMetadata,
} from '../contracts'

export function loadAllArtifacts() {
  CAT20OpenMinterMetadata.loadArtifact(cat20OpenMinterMetadata)
  CAT20ClosedMinterMetadata.loadArtifact(cat20ClosedMinterMetadata)
  CAT20ClosedMinter.loadArtifact(cat20ClosedMinter)
  CAT20OpenMinter.loadArtifact(cat20OpenMinter)
  CAT20.loadArtifact(cat20)
  CAT20Guard.loadArtifact(cat20Guard)
  CAT20StateLib.loadArtifact(cat20StateLib)
  CAT20GuardStateLib.loadArtifact(cat20GuardStateLib)
  ConstantsLib.loadArtifact(constants)
}

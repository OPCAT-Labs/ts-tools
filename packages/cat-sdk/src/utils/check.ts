export function checkArgument(
  condition: boolean,
  argumentName: string,
  message?: string
) {
  if (!condition) {
    let errorMessage = `Invalid argument: ${argumentName}`
    if (message) {
      errorMessage += ` : ${message}`
    }
    throw new Error(errorMessage)
  }
}

export function checkState(
  condition: boolean,
  stateName: string,
  message?: string
) {
  if (!condition) {
    let errorMessage = `Invalid state: ${stateName}`
    if (message) {
      errorMessage += ` : ${message}`
    }
    throw new Error(errorMessage)
  }
}

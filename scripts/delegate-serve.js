import sade from 'sade'
import { getClient } from '@web3-storage/w3cli/lib.js'
import * as ed25519 from '@ucanto/principal/ed25519'
import { Space } from '@web3-storage/capabilities'

const cli = sade('delegate-serve.js [space] [token]')

cli
  .describe(
    `Delegates ${Space.contentServe.can} to the Gateway for a test space generated by the script, with an optional auth token. Outputs a base64url string suitable for the stub_delegation query parameter. Pipe the output to pbcopy or similar for the quickest workflow. If the GATEWAY_PRINCIPAL_KEY environment variable is not set, a new key pair will be generated.`
  )
  .action(async (space, token) => {
    const client = await getClient()

    let newSpace
    let proofs = []
    if (!space) {
      newSpace = await client.createSpace('test')
      const authProof = await newSpace.createAuthorization(client.agent)
      await client.addSpace(authProof)
      proofs = [authProof]
    } else {
      newSpace = space
      proofs = client.proofs([
        {
          can: Space.contentServe.can,
          with: newSpace.did(),
        }
      ])
    }

    const signer =
      process.env.GATEWAY_PRINCIPAL_KEY
        ? ed25519.Signer.parse(process.env.GATEWAY_PRINCIPAL_KEY)
        : await ed25519.Signer.generate()

    const gatewayIdentity = signer.withDID('did:web:w3s.link')
    const delegation = await Space.contentServe.delegate({
      issuer: client.agent.issuer,
      audience: gatewayIdentity,
      with: newSpace.did(),
      expiration: Infinity,
      proofs
    })
    
    await client.capability.access.delegate({
      delegations: [delegation],
    })
    
    const carResult = await delegation.archive()
    if (carResult.error) throw carResult.error
    const base64Url = Buffer.from(carResult.ok).toString('base64url')
    process.stdout.write(`Agent Proofs: ${proofs.flatMap(p => p.capabilities).map(c => `${c.can} with ${c.with}`).join('\n')}\n`)
    process.stdout.write(`Issuer: ${client.agent.issuer.did()}\n`)
    process.stdout.write(`Audience: ${gatewayIdentity.did()}\n`)
    process.stdout.write(`Space: ${newSpace.did()}\n`)
    process.stdout.write(`Token: ${token ?? 'none'}\n`)
    process.stdout.write(`Delegation: ${delegation.capabilities.map(c => `${c.can} with ${c.with}`).join('\n')}\n`)
    process.stdout.write(`Stubs: stub_space=${newSpace.did()}&stub_delegation=${base64Url}&authToken=${token ?? ''}\n`)
  })

cli.parse(process.argv)

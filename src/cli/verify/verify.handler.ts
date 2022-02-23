import fs from "node:fs";
import chalk from "chalk";
import { VerifyCliArgs } from "./verify.types";
import { bootstrap, IServices } from "../../bootstrap";
import { Address, ChainId } from "../../types";
import { toBN } from "../../libs/utils";
import { Contract } from "../../models/contract";
import { ParallelProcessorOptions } from "../../services/processor.service";
import { logger } from "../../logger";

const log = logger.child({});

/**
 * Execution the `verify` command
 *
 * @param args
 */
export async function handleVerifyCommand(args: VerifyCliArgs): Promise<void> {
  log.info('command: verify');

  // process cli args
  const {
    address,
    chainId,
    skip,
    save,
    failFast,
    jump,
    dirs,
    concurrency,
  } = args;

  const options: ParallelProcessorOptions = {
    jump,
    failFast,
    save,
    skip, 
    concurrency,
  }

  // validate the arguments

  const services = await bootstrap();

  if (chainId || address) {
    if (!chainId) {
      throw new Error('--chainId is required with --address');
    }
    const nchainId = toBN(chainId).toNumber();
    await handleChainId(services, nchainId, address, options);
  }

  else if (dirs) {
    await handleDirs(services, dirs, options);
  }

  else {
    const msg = 'You must provide either --chainId or --dirs';
    throw new Error(msg);
  }

  // success
  log.info(`${chalk.green('✔')} success: verification complete`);
}


/**
 * Verify all contracts for a chain
 *
 * @param services
 * @param chainId
 * @param address
 * @param skip
 */
async function handleChainId(
  services: IServices,
  chainId: ChainId,
  address: undefined | Address,
  options: ParallelProcessorOptions,
): Promise<void> {

  const contracts: Contract[] = [];
  if (address) {
    contracts.push(await services
      .contractService
      .getContract({ chainId, address }));
  } else {
    contracts.push(...await services
      .contractService
      .getChainContracts({ chainId }));
  }

  await services
    .processorService
    .process(contracts, options);
}

/**
 * Verify all contract directories specified
 *
 * @param services  application services
 * @param dirs      directories with contracts
 * @param options   processing options
 */
async function handleDirs(
  services: IServices,
  dirs: string,
  options: ParallelProcessorOptions,
): Promise<void> {
  let dirnames: string[];

  if (dirs === '-') {
    // read from stdsin
    dirnames = fs
      .readFileSync(0, 'utf-8',)
      .trim()           // remove trailing whitespace
      .split('\n')      // split new lines
      .filter(Boolean); // remove empty lines
  } else {
    // new-line separated directories
    dirnames = dirs.split('\n').filter(Boolean);
  }

  const contracts = await services
    .contractService
    .hydrateContracts(dirnames.map(dirname => ({ dirname })));

  await services
    .processorService
    .process(contracts, options);
}

// Library data is scoped by wallet address and Qortal name. There are no shared
// favorite/history atoms: readers use useLibrary for the current account.
export { libraryAccount } from '../services/library/model';

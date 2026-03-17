type NameDataResponse = {
  owner?: string;
  ownerAddress?: string;
  address?: string;
};

const normalizeAddress = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveNameWalletAddress = async (
  name: string
): Promise<string | null> => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return null;
  }

  const response = (await qortalRequest({
    action: 'GET_NAME_DATA',
    name: trimmedName,
  })) as NameDataResponse | null;

  if (!response || typeof response !== 'object') {
    return null;
  }

  return (
    normalizeAddress(response.owner) ||
    normalizeAddress(response.ownerAddress) ||
    normalizeAddress(response.address)
  );
};

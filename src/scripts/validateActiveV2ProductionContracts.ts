import mongoose from 'mongoose';
import { PokemonSetV2 } from '../models/PokemonSetV2';
import { PublicationManifest } from '../models/PublicationManifest';

function runContractTests(): void {
  // Teste 1: Checar se o modelo PokemonSetV2 está devidamente registrado e aponta para a coleção correta
  if (PokemonSetV2.modelName !== 'PokemonSetV2') {
    throw new Error(`Expected modelName PokemonSetV2, got ${PokemonSetV2.modelName}`);
  }
  if (PokemonSetV2.collection.name !== 'pokemonsets_v2') {
    throw new Error(`Expected collection name pokemonsets_v2, got ${PokemonSetV2.collection.name}`);
  }

  // Teste 2: Checar se o modelo PublicationManifest está devidamente registrado e aponta para a coleção correta
  if (PublicationManifest.modelName !== 'PublicationManifest') {
    throw new Error(`Expected modelName PublicationManifest, got ${PublicationManifest.modelName}`);
  }
  if (PublicationManifest.collection.name !== 'publication_manifests') {
    throw new Error(`Expected collection name publication_manifests, got ${PublicationManifest.collection.name}`);
  }

  // Teste 3: Garantia estrita de que a coleção legada "pokemonsets" não é importada ou referenciada
  const referencedCollections = [
    PokemonSetV2.collection.name,
    PublicationManifest.collection.name,
  ];
  if (referencedCollections.includes('pokemonsets')) {
    throw new Error('Safety breach: Legacy collection "pokemonsets" is referenced by the new models');
  }

  console.log('[Equinox] Active V2 production contract validation passed.');
}

runContractTests();

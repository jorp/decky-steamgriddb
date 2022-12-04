import {
  useState,
  createContext,
  FC,
  useContext,
  useCallback,
  useMemo,
  useEffect
} from 'react';
import { showModal } from 'decky-frontend-lib';
import isEqual from 'react-fast-compare';
import debounce from 'just-debounce';

import useSettings from '../hooks/useSettings';
import { useSGDB } from '../hooks/useSGDB';
import FiltersModal from '../modals/FiltersModal';
import GameSelectionModal from '../modals/GameSelectionModal';
import MenuIcon from '../components/Icons/MenuIcon';
import log from '../utils/log';
import { MIMES, STYLES, DIMENSIONS } from '../constants';

export type AssetSearchContextType = {
  loading: boolean;
  assets: any[];
  searchAndSetAssets: (assetType: SGDBAssetType, filters: any, onSuccess?: () => void) => Promise<void>;
  openFilters: (assetType: SGDBAssetType) => void;
  games: any[];
  selectedGame: any;
  isFilterActive: boolean;
}

export const SearchContext = createContext({});

let abortCont: AbortController | null = null;

export const AssetSearchContext: FC = ({ children }) => {
  const { set, get } = useSettings();
  const { appId, searchAssets, searchGames, isNonSteamShortcut, appDetails, serverApi } = useSGDB();
  const [assets, setAssets] = useState<Array<any>>([]);
  const [currentFilters, setCurrentFilters] = useState();
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any>();

  const compareFilterWithDefaults = useCallback((assetType, filters) => {
    if (!filters) return false;
    // simply cannot be fucked to do this in a better way
    return (
      (filters?.styles ? !isEqual([...filters.styles].sort(), [...STYLES[assetType].default].sort()) : false) ||
      (filters?.dimensions ? !isEqual([...filters.dimensions].sort(), [...DIMENSIONS[assetType].default].sort()) : false) ||
      (filters?.mimes ? !isEqual([...filters.mimes].sort(), [...MIMES[assetType].default].sort()) : false) ||
      filters?.animated !== true ||
      filters?._static !== true ||
      filters?.humor !== true ||
      filters?.epilepsy !== true ||
      filters?.untagged !== true
    );
  }, []);

  const searchAndSetAssets = useMemo(() => debounce(async (assetType, filters, onSuccess) => {
    if (isNonSteamShortcut && !selectedGame) return;
    if (abortCont) abortCont?.abort();
    abortCont = new AbortController();

    try {
      setCurrentFilters(filters);
      setIsFilterActive(compareFilterWithDefaults(assetType, filters));
      const resp = await searchAssets(assetType, {
        gameId: selectedGame?.id,
        filters,
        signal: abortCont.signal
      });
      log('search resp', assetType, resp);
      setAssets(resp);
      onSuccess?.();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        log('Search Aborted');
      } else {
        serverApi.toaster.toast({
          title: 'SteamGridDB API Error',
          body: err.message,
          icon: <MenuIcon fill="#f3171e" />
        });
        if (selectedGame) {
          set(`nonsteam_${appId}`, false);
        }
      }
    }
  }, 500), [appId, compareFilterWithDefaults, isNonSteamShortcut, searchAssets, selectedGame, serverApi.toaster, set]) as AssetSearchContextType['searchAndSetAssets'];

  const handleFiltersSave = useCallback(async (assetType: SGDBAssetType, filters, game) => {
    if (!isEqual(filters, currentFilters)) {
      setLoading(true);
      searchAndSetAssets(assetType, filters, () => {
        setLoading(false);
      });
      set(`filters_${assetType}`, filters, true);
      setCurrentFilters(filters);
    }
    if (game && game.id !== selectedGame?.id) {
      setSelectedGame(game);
      // save selected game to reuse for this shortcut
      set(`nonsteam_${appId}`, game);
    }
    setIsFilterActive(compareFilterWithDefaults(assetType, filters));
  }, [currentFilters, compareFilterWithDefaults, searchAndSetAssets, selectedGame, set, appId]);

  const openFilters = useCallback(async (assetType: SGDBAssetType) => {
    log('Open Filters');
    const defaultFilters = await get(`filters_${assetType}`, null);
    showModal(<FiltersModal
      assetType={assetType}
      onSave={handleFiltersSave}
      defaultFilters={defaultFilters}
      isNonSteamShortcut={isNonSteamShortcut}
      defaultSelectedGame={selectedGame}
      searchGames={searchGames}
    />, window);
  }, [get, handleFiltersSave, isNonSteamShortcut, searchGames, selectedGame]);

  useEffect(() => {
    if (!appDetails || !isNonSteamShortcut) return;
    (async () => {
      setLoading(true);
      const game = await get(`nonsteam_${appId}`, false);
      if (game) {
        setSelectedGame(game);
      } else {
        const gameRes = await searchGames(appDetails.strDisplayName);
        if (gameRes.length) {
          setSelectedGame(gameRes[0]);
        } else {
          // open search and selection
          showModal(<GameSelectionModal
            defaultTerm={appDetails.strDisplayName}
            searchGames={searchGames}
            onSelect={(game: any) => {
              setSelectedGame(game);
            }}
          />);
        }
      }
      setLoading(false);
    })();
  }, [appDetails, appId, get, isNonSteamShortcut, searchGames]);

  const value = useMemo(() => ({
    loading,
    assets,
    searchAndSetAssets,
    selectedGame,
    openFilters,
    isFilterActive
  }), [loading, assets, searchAndSetAssets, selectedGame, openFilters, isFilterActive]);
  
  return <SearchContext.Provider value={value}>
    {children}
  </SearchContext.Provider>;
};

export const useAssetSearch = () => useContext(SearchContext) as AssetSearchContextType;

export default useAssetSearch;

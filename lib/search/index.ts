import actions from '../state/actions';
import { init, updateFilter } from './worker';

import * as A from '../state/action-types';
import * as S from '../state';
import * as T from '../types';

const emptyList = [] as T.NoteEntity[];

export const middleware: S.Middleware = store => {
  const {
    port1: searchProcessor,
    port2: _searchProcessor,
  } = new MessageChannel();

  const setFilteredNotes = (
    noteIds: Set<T.EntityId>,
    previousIndex?: number
  ) => {
    const { appState } = store.getState();
    store.dispatch(
      actions.ui.filterNotes(
        appState.notes?.filter(({ id }) => noteIds.has(id)) || emptyList,
        previousIndex
      )
    );
  };

  searchProcessor.onmessage = event => {
    switch (event.data.action) {
      case 'filterNotes': {
        setFilteredNotes(event.data.noteIds);
        break;
      }
    }
  };

  init(_searchProcessor);
  let hasInitialized = false;

  return next => (action: A.ActionType) => {
    const result = next(action);

    switch (action.type) {
      case 'App.notesLoaded':
        if (!hasInitialized) {
          action.notes.forEach(note =>
            searchProcessor.postMessage({
              action: 'updateNote',
              noteId: note.id,
              data: note.data,
            })
          );

          hasInitialized = true;
        }
        searchProcessor.postMessage({ action: 'filterNotes' });
        break;

      case 'REMOTE_NOTE_UPDATE':
        searchProcessor.postMessage({
          action: 'updateNote',
          noteId: action.noteId,
          data: action.data,
        });
        break;

      case 'OPEN_TAG':
        searchProcessor.postMessage({
          action: 'filterNotes',
          openedTag: action.tag.data.name,
        });
        break;

      case 'SELECT_TRASH':
        searchProcessor.postMessage({
          action: 'filterNotes',
          openedTag: null,
          showTrash: true,
        });
        break;

      case 'SHOW_ALL_NOTES':
        searchProcessor.postMessage({
          action: 'filterNotes',
          openedTag: null,
          showTrash: false,
        });
        break;

      case 'SEARCH':
        searchProcessor.postMessage({
          action: 'filterNotes',
          searchQuery: action.searchQuery,
        });
        break;

      case 'DELETE_NOTE_FOREVER':
      case 'RESTORE_NOTE':
      case 'TRASH_NOTE':
        setFilteredNotes(updateFilter('fullSearch'), action.previousIndex);
        break;

      case 'App.authChanged':
        setFilteredNotes(updateFilter('fullSearch'));
        break;
    }

    return result;
  };
};

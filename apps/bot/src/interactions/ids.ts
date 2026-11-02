/** Префиксы customId. Формат: prefix:arg1:arg2 */
export const EXPLAIN_BUTTON_PREFIX = 'explain';
export const EXPLAIN_MODAL_PREFIX = 'explain_modal';
export const EXPLAIN_INPUT = 'explain_text';

export const PANEL_JOINDATE = 'panel_joindate';
export const PANEL_JOINDATE_MODAL = 'panel_joindate_modal';
export const PANEL_JOINDATE_INPUT = 'panel_joindate_input';

export const PANEL_PROBATION = 'panel_probation';

export const PANEL_VACATION = 'panel_vacation';
export const PANEL_VACATION_MODAL = 'panel_vacation_modal';
export const PANEL_VACATION_INPUT = 'panel_vacation_input';

export const PANEL_DELETE = 'panel_delete';
export const PANEL_DELETE_CONFIRM = 'panel_delete_confirm';
export const PANEL_DELETE_CANCEL = 'panel_delete_cancel';

export const parseId = (customId: string) => {
  const [prefix, ...args] = customId.split(':');
  return { prefix, args };
};

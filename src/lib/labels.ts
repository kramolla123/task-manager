import type { AssetKind, Priority, ReviewState, Role, TaskStatus } from "./types";

export type Tone = "neutral" | "info" | "progress" | "warn" | "success" | "danger" | "design";

export const ROLE_LABELS: Record<Role, string> = {
  production_head: "Руководитель производства",
  sales_head: "Руководитель продаж",
  sales_manager: "Менеджер",
  creator: "Креатор",
  stylist: "Стилист",
  designer: "Дизайнер",
  pending: "Ожидает роли",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: "К выполнению",
  stylist: "У стилиста",
  in_progress: "В работе",
  review: "На согласовании",
  rework: "Доработка",
  ready: "Готово",
  testing: "Тестирование",
  design: "Дизайн",
  design_review: "Согласование дизайна",
  design_rework: "Доработка дизайна",
  completed: "Завершено",
  cancelled: "Отменено",
};

export const STATUS_TONES: Record<TaskStatus, Tone> = {
  to_do: "neutral",
  stylist: "info",
  in_progress: "progress",
  review: "warn",
  rework: "danger",
  ready: "success",
  testing: "info",
  design: "design",
  design_review: "warn",
  design_rework: "danger",
  completed: "success",
  cancelled: "neutral",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  Low: "Низкий",
  Medium: "Средний",
  High: "Высокий",
};

export const PRIORITY_TONES: Record<Priority, Tone> = {
  Low: "neutral",
  Medium: "warn",
  High: "danger",
};

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  manager_reference: "Референсы менеджера",
  stylist_reference: "Референсы стилиста",
  ai: "AI-изображения",
  design: "Дизайн",
  test_screenshot: "Скриншоты теста",
};

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  pending: "Ожидает",
  approved: "Утверждено",
  rejected: "На доработке",
};

export const REVIEW_STATE_TONES: Record<ReviewState, Tone> = {
  pending: "neutral",
  approved: "success",
  rejected: "danger",
};

export const ROUTE_LABELS: Record<string, string> = {
  testing: "Тестирование",
  design: "Дизайн",
};

export const ACTION_LABELS: Record<string, string> = {
  create: "Заявка создана",
  created: "Заявка создана",
  claim: "Взята в работу",
  set_stylist: "Выбран режим стилизации",
  finish_stylist: "Стилизация завершена",
  submit_ai: "AI-изображения отправлены на согласование",
  stylist_review: "Заключение стилиста",
  approve_ai: "AI-изображения утверждены",
  reject_ai: "AI-изображения возвращены на доработку",
  start_test: "Тестирование запущено",
  finish_test: "Тестирование завершено",
  assign: "Назначены исполнители",
  submit_design: "Дизайн отправлен на согласование",
  approve_design: "Дизайн утверждён",
  reject_design: "Дизайн возвращён на доработку",
  update: "Заявка изменена",
  deadline: "Изменён дедлайн",
  cancel: "Заявка отменена",
  create_slot: "Добавлен слот материала",
  add_version: "Загружена версия файла",
  status_change: "Смена статуса",
};

export const REJECTION_REASONS = [
  "Не соответствует ТЗ",
  "Искажён товар (форма, цвет, фактура)",
  "Артефакты генерации",
  "Композиция / ракурс",
  "Свет и цвет",
  "Фон / окружение",
  "Не учтено заключение стилиста",
  "Другое",
];

export const FIELD_LABELS: Record<string, string> = {
  product_url: "Ссылка на товар",
  ld_article: "LD артикул",
  description: "Описание",
  requested_photos: "Кол-во фото",
  source_url: "Источник",
  priority: "Приоритет",
  status: "Статус",
  deadline_at: "Дедлайн",
  creator_id: "Креатор",
  stylist_id: "Стилист",
  designer_id: "Дизайнер",
  stylist_required: "Нужен стилист",
  current_cycle: "Цикл AI",
  design_cycle: "Цикл дизайна",
  reason: "Причина",
  comment: "Комментарий",
  bypass_reason: "Причина обхода",
  canva_url: "Canva",
  notes: "Заметки",
  ctr_best: "CTR лучшего",
  ctr_worst: "CTR худшего",
  used_main: "Использовано как основное",
  slot_ids: "Фото",
  category_id: "Категория",
  kind: "Тип",
  filename: "Файл",
  slot_id: "Слот",
  version_number: "Версия",
  cycle: "Цикл",
  required: "Нужен стилист",
};
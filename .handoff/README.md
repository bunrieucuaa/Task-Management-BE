# `.handoff/` — Tài liệu bàn giao ngữ cảnh (Backend)

Thư mục này giúp **tiếp tục công việc sau khi reset/đổi cửa sổ chat** với Claude Code
mà không tốn token đọc lại toàn bộ source.

## Cách dùng khi mở chat mới

1. Mở chat mới, yêu cầu Claude: *"Đọc `task-be/.handoff/` rồi tiếp tục."*
2. Claude đọc theo thứ tự:
   - [`context.md`](context.md) — kiến trúc, stack, quy ước, các điểm "gotcha".
   - [`testing.md`](testing.md) — bộ test: cách chạy, cấu trúc, đã cover gì.
   - [`progress.md`](progress.md) — nhật ký phiên: đã làm gì, đang dở gì, việc kế tiếp.
3. Trước khi kết thúc mỗi phiên, cập nhật **`progress.md`** (mục "Trạng thái hiện tại"
   và "Việc kế tiếp"). Đây là file quan trọng nhất để nối tiếp công việc.

## Quy ước

- Mỗi file một mục đích rõ ràng; đừng nhồi nhật ký vào `context.md`.
- Ghi **quyết định + lý do**, không chỉ "đã làm X" — để phiên sau hiểu *tại sao*.
- File này **được commit** cùng repo (đi theo code, lên git).

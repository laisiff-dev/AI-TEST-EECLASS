#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ee-Class 智慧題目轉換器 (Command Line Interface)
將 AI 產生的選擇題與是非題文字檔案轉換為 ee-Class 專用 CSV 或 GIFT 格式

使用方式:
    python convert_ai_to_eeclass.py input.txt -o output.csv
    python convert_ai_to_eeclass.py input.txt --format gift -o output.gift
"""

import sys
import re
import csv
import argparse
import unicodedata
from pathlib import Path

# ee-Class 標準欄位名稱 (Row 2 Header)
EECLASS_HEADERS = [
    '題組',
    '類別 \n(格式相容欄位，匯入線上測驗時不支援)',
    '題型: \n(1)是非\n(2)單選  \n(3)複選  \n(4)填充 \n(5)問答\n(6)說明\n(7)題組',
    '題目',
    '答案\n若為是非題: \n(1)答案為是\n(2)答案為否',
    '解說\n(說明沒有解說)',
    '難易度:\n(1)容易\n(2)適中\n(3)困難',
    '選項1\n若為填充題: \n(1)不區分英文大小寫\n(2)區分英文大小寫',
    '選項2 \n若為填充題: \n(1)不需考慮順序\n(2)需考慮順序 ',
    '選項3 ',
    '選項4',
    '選項5',
    '選項6',
    '選項7',
    '選項8',
    '選項9',
    '選項10',
    '選項11',
    '選項12',
    '選項13',
    '選項14',
    '選項15',
    '選項16',
    '選項17',
    '選項18',
    '選項19',
    '選項20'
]

def normalize_text(text: str) -> str:
    """全形英數轉半形，清理 markdown 標記"""
    if not text:
        return ""
    # NFKC 將全形英數轉半形
    normalized = unicodedata.normalize('NFKC', text)
    # 移除 markdown 粗體與行內程式碼
    normalized = re.sub(r'\*\*', '', normalized)
    normalized = re.sub(r'`', '', normalized)
    return normalized

def parse_tf_answer(ans_str: str):
    """解析是非題答案 -> 1 (是) 或 2 (否)"""
    if not ans_str:
        return None
    s = ans_str.strip().upper()
    if re.search(r'^(1|O|○|⭕|T|TRUE|是|對|正確|YES|V|✔)$', s, re.IGNORECASE) or re.search(r'^[（(][O○⭕T是丵對V✔][）)]$', s):
        return 1
    if re.search(r'^(2|X|╳|✕|✘|F|FALSE|否|錯|錯誤|NO)$', s, re.IGNORECASE) or re.search(r'^[（(][X╳✕✘F否錯][）)]$', s):
        return 2
    if re.search(r'(正確|答案[：:\s]*[O○⭕T是丵對]|為[是丵對]|選[是丵對])', s):
        return 1
    if re.search(r'(錯誤|不正確|答案[：:\s]*[X╳✕✘F否錯]|為[否錯]|選[否錯])', s):
        return 2
    return None

def parse_choice_answer(ans_str: str):
    """解析單選題答案 -> 1-based index (A->1, B->2, C->3, D->4...)"""
    if not ans_str:
        return None
    match = re.search(r'([A-Za-z]|\d+)', ans_str)
    if not match:
        return None
    val = match.group(1).upper()
    if re.match(r'^[A-Z]$', val):
        return ord(val) - ord('A') + 1
    try:
        return int(val)
    except ValueError:
        return None

def parse_difficulty(diff_str: str) -> int:
    """解析難易度 -> 1 (容易), 2 (適中), 3 (困難)"""
    if not diff_str:
        return 2
    s = diff_str.strip().lower()
    if any(k in s for k in ['1', '易', '容易', '簡單', 'easy']):
        return 1
    if any(k in s for k in ['3', '難', '困難', '高', 'hard']):
        return 3
    return 2

def split_inline_options(line: str):
    """拆解單行內之多個選項 (例如: (A) 10 (B) 20 (C) 30 (D) 40)"""
    pattern = re.compile(r'(?:^|\s+)(?:[（(\[]([A-Ha-h])[）)\]]|([A-Ha-h])[.、．])\s*')
    matches = list(pattern.finditer(line))
    if len(matches) < 2:
        return None

    prefix = line[:matches[0].start()].strip()
    options = []
    for i, m in enumerate(matches):
        letter = (m.group(1) or m.group(2)).upper()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        opt_text = line[start:end].strip()
        options.append({'letter': letter, 'text': opt_text})

    return {'prefix': prefix, 'options': options}

def parse_quiz_text(raw_text: str):
    """解析題庫文字為題目物件列表"""
    normalized = normalize_text(raw_text)
    lines = normalized.split('\n')

    questions = []
    current_section = None  # 1: 是非, 2: 單選
    blocks = []
    current_block = []

    def check_section(l):
        trimmed = l.strip()
        if re.search(r'^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(是非題|判斷題|對錯題)', trimmed, re.I) or re.search(r'^【?(是非題|判斷題|對錯題)】?$', trimmed, re.I):
            return 1
        if re.search(r'^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(單選題|選擇題)', trimmed, re.I) or re.search(r'^【?(單選題|選擇題)】?$', trimmed, re.I):
            return 2
        return None

    def is_q_start(l):
        trimmed = l.strip()
        if re.search(r'^[（(\[]?[A-Ha-h][）)\]][.、．\s]', trimmed):
            return False
        if re.search(r'^[A-Ha-h][.、．\s]', trimmed):
            return False
        if re.search(r'^[（(\[]\s*[1-6]\s*[）\]]', trimmed):
            return False
        if re.search(r'^(Q\s*\d+|第\s*\d+\s*題|\d+)[.、．:：\s]', trimmed, re.I):
            return True
        if re.search(r'^【\s*\d+\s*】', trimmed):
            return True
        if re.search(r'^[（(]\s*\d+\s*[）)]\s*', trimmed):
            return True
        if re.search(r'^\[(單選|是非|選擇)\]', trimmed, re.I):
            return True
        return False

    for line in lines:
        trimmed = line.strip()
        new_sec = check_section(trimmed)
        if new_sec is not None:
            if current_block:
                blocks.append({'sec': current_section, 'lines': current_block})
                current_block = []
            current_section = new_sec
            continue

        if is_q_start(trimmed):
            if current_block:
                blocks.append({'sec': current_section, 'lines': current_block})
                current_block = []

        if trimmed or current_block:
            current_block.append(line)

    if current_block:
        blocks.append({'sec': current_section, 'lines': current_block})

    # 解析各 block
    lead_num_pat = re.compile(r'^(Q\s*\d+|第\s*\d+\s*題|\d+|【\s*\d+\s*】|[（(]\s*\d+\s*[）)])[.、．:：\s]*', re.I)

    for idx, b in enumerate(blocks):
        b_lines = b['lines']
        sec_type = b['sec']

        q_text = ""
        options = []
        ans_raw = ""
        explanation = ""
        difficulty = 2
        explicit_type = sec_type
        state = 'QUESTION'

        for l in b_lines:
            line_str = l.strip()
            if not line_str:
                continue

            if re.search(r'^(\[(單選|選擇)\]|【(單選|選擇)】)', line_str, re.I):
                explicit_type = 2
                line_str = re.sub(r'^(\[(單選|選擇)\]|【(單選|選擇)】)\s*', '', line_str, flags=re.I)
            elif re.search(r'^(\[(是非|判斷)\]|【(是非|判斷)】)', line_str, re.I):
                explicit_type = 1
                line_str = re.sub(r'^(\[(是非|判斷)\]|【(是非|判斷)】)\s*', '', line_str, flags=re.I)

            # 難度
            diff_m = re.search(r'(?:難易度|難度|Difficulty)[：:\s]*([^\n,，]+)', line_str, re.I)
            if diff_m:
                difficulty = parse_difficulty(diff_m.group(1))
                line_str = re.sub(r'(?:難易度|難度|Difficulty)[：:\s]*[^\n,，]+', '', line_str, flags=re.I).strip()
                if not line_str:
                    continue

            # 答案
            ans_m = re.search(r'^(?:正確答案|答案|Ans|Answer|Key)[：:\s]*(.+)$', line_str, re.I) or \
                    re.search(r'^【(?:正確答案|答案|Ans)】\s*(.+)$', line_str, re.I)
            if ans_m:
                state = 'ANSWER'
                rem = ans_m.group(1).strip()
                inl_exp = re.search(r'^(.*?)(?:[；;，,]\s*|\s+)(?:解析|詳解|說明|解說|Rationale|Explanation)[：:\s]*(.*)$', rem, re.I)
                if inl_exp:
                    ans_raw = inl_exp.group(1).strip()
                    explanation = inl_exp.group(2).strip()
                    state = 'EXPLANATION'
                else:
                    ans_raw = rem
                continue

            # 解析
            exp_m = re.search(r'^(?:解析|詳解|說明|解說|Rationale|Explanation)[：:\s]*(.*)$', line_str, re.I) or \
                    re.search(r'^【(?:解析|詳解|說明|解說)】\s*(.*)$', line_str, re.I)
            if exp_m:
                state = 'EXPLANATION'
                explanation = (explanation + "\n" + exp_m.group(1).strip()).strip()
                continue

            if state == 'EXPLANATION':
                explanation = (explanation + "\n" + line_str).strip()
                continue

            # 單行多個選項
            inline_info = split_inline_options(line_str)
            if inline_info and len(inline_info['options']) >= 2:
                if state == 'QUESTION' and inline_info['prefix']:
                    clean_pre = lead_num_pat.sub('', inline_info['prefix']).strip()
                    if clean_pre:
                        q_text = (q_text + "\n" + clean_pre).strip()
                state = 'OPTIONS'
                options.extend([opt['text'] for opt in inline_info['options']])
                continue

            # 單個選項
            opt_m = re.search(r'(?:^|(.*?)\s+)(?:[（(\[]([A-Ha-h])[）)\]]|([A-Ha-h])[.、．])\s*(.*)$', line_str)
            if opt_m:
                prefix = (opt_m.group(1) or '').strip()
                opt_text = (opt_m.group(4) or '').strip()
                if state == 'QUESTION' and prefix:
                    clean_pre = lead_num_pat.sub('', prefix).strip()
                    if clean_pre:
                        q_text = (q_text + "\n" + clean_pre).strip()
                state = 'OPTIONS'
                options.append(opt_text)
                continue

            if state == 'OPTIONS' and options:
                options[-1] += " " + line_str
                continue

            if state == 'QUESTION':
                if not q_text:
                    clean_stem = lead_num_pat.sub('', line_str).strip()
                    lead_tf = re.search(r'^[（(]([O○⭕TX╳✕✘F是丵否對錯])[）)][\s、.．]*(.*)$', clean_stem, re.I)
                    if lead_tf:
                        explicit_type = 1
                        if not ans_raw:
                            ans_raw = lead_tf.group(1)
                        clean_stem = lead_tf.group(2).strip()

                    tail_tf = re.search(r'^(.*?)\s*[（(]([O○⭕TX╳✕✘F是丵否對錯])[）)]\s*$', clean_stem, re.I)
                    if tail_tf and not ans_raw:
                        explicit_type = 1
                        ans_raw = tail_tf.group(2)
                        clean_stem = tail_tf.group(1).strip()

                    q_text = clean_stem
                else:
                    q_text += "\n" + line_str

        # 題型判定
        q_type = explicit_type
        if not q_type:
            if len(options) >= 2:
                q_type = 2
            elif parse_tf_answer(ans_raw) is not None:
                q_type = 1
            else:
                q_type = 2 if len(options) > 0 else 1

        final_ans = None
        if q_type == 1:
            final_ans = parse_tf_answer(ans_raw)
        else:
            final_ans = parse_choice_answer(ans_raw)

        if q_text or options:
            questions.append({
                'index': idx + 1,
                'type': q_type,
                'stem': q_text or f"(第 {idx + 1} 題未填題幹)",
                'options': options,
                'answer': final_ans,
                'raw_answer': ans_raw,
                'explanation': explanation,
                'difficulty': difficulty
            })

    return questions

def export_eeclass_csv(questions, output_path: str):
    """匯出符合 ee-Class 官方標準格式 (Version 4 規範, 27 欄逗號分隔, UTF-8 with BOM) 的 CSV 檔案"""
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=',', quoting=csv.QUOTE_MINIMAL, lineterminator='\r\n')
        
        # Row 1
        row1 = ['version: 4'] + [''] * 26
        writer.writerow(row1)

        # Row 2 (Header)
        writer.writerow(EECLASS_HEADERS)

        # Row 3+
        for q in questions:
            row = [''] * 27
            row[0] = ''
            row[1] = ''
            row[2] = str(q['type'])
            row[3] = q['stem']
            row[4] = str(q['answer']) if q['answer'] is not None else ''
            row[5] = q['explanation']
            row[6] = str(q['difficulty'])

            if q['type'] == 2 and q['options']:
                for i in range(20):
                    if i < len(q['options']):
                        row[7 + i] = q['options'][i]
                    else:
                        row[7 + i] = ''
            else:
                for i in range(20):
                    row[7 + i] = ''

            writer.writerow(row)

def export_gift(questions, output_path: str):
    """匯出 Moodle / ee-Class 相容之 GIFT 格式"""
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('// GIFT Format exported for ee-class\n\n')
        for idx, q in enumerate(questions):
            title = f"::Q{idx + 1}::"
            stem = re.sub(r'[{}=~#]', r'\\\g<0>', q['stem'])
            exp = re.sub(r'[{}=~#]', r'\\\g<0>', q['explanation'])
            feedback = f"#{exp}" if exp else ""

            if q['type'] == 1:
                tf_char = 'TRUE' if q['answer'] == 1 else 'FALSE'
                f.write(f"{title} {stem} {{{tf_char}{feedback}}}\n\n")
            else:
                f.write(f"{title} {stem} {{\n")
                ans_idx = q['answer']
                for opt_idx, opt_text in enumerate(q['options']):
                    is_correct = (opt_idx + 1) == ans_idx
                    prefix = '=' if is_correct else '~'
                    clean_opt = re.sub(r'[{}=~#]', r'\\\g<0>', opt_text)
                    item_fb = feedback if is_correct else ''
                    f.write(f"    {prefix}{clean_opt}{item_fb}\n")
                f.write("}\n\n")

def validate_questions(questions):
    """嚴格格式合規性檢核 (Strict Validation)，確保 100% 符合 ee-Class 官方規範"""
    errors = []
    warnings = []

    if not questions:
        errors.append("未解析出任何有效題目！請確認題目包含題號、題幹與答案。")
        return errors, warnings

    for q in questions:
        idx = q['index']
        stem = q.get('stem', '').strip()
        if not stem or stem.startswith(f"(第 {idx} 題未填"):
            errors.append(f"[第 {idx} 題] 題幹內容為空")

        # 單選題檢核
        if q['type'] == 2:
            opts = q.get('options', [])
            if not opts or len(opts) < 2:
                errors.append(f"[第 {idx} 題] 單選題選項少於 2 個 (目前僅有 {len(opts)} 個)")
            if q['answer'] is None:
                errors.append(f"[第 {idx} 題] 單選題尚未指定正確答案 (例如 答案：A)")
            elif opts and (q['answer'] < 1 or q['answer'] > len(opts)):
                errors.append(f"[第 {idx} 題] 答案標記為第 {q['answer']} 項，超出選項總數 ({len(opts)} 項)")

        # 是非題檢核
        elif q['type'] == 1:
            if q['answer'] is None or q['answer'] not in (1, 2):
                errors.append(f"[第 {idx} 題] 是非題未指定有效答案 (需標記 答案：O 或 答案：X)")

        if not q.get('explanation'):
            warnings.append(f"[第 {idx} 題] 未填寫題目解析 (選填建議)")

    return errors, warnings

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="ee-Class 智慧題目轉換器 (CLI)")
    parser.add_argument("input", help="輸入的題庫文字檔案路徑 (例如: questions.txt)")
    parser.add_argument("-o", "--output", help="輸出的檔案路徑 (預設: eeClass_output.csv)")
    parser.add_argument("-f", "--format", choices=["csv", "gift"], default="csv", help="輸出格式 (csv 或 gift，預設 csv)")
    parser.add_argument("--no-strict", action="store_true", help="關閉嚴格防呆阻擋（即使有缺答案或選項不足仍強制匯出）")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[錯誤] 找不到輸入檔案: {input_path}")
        sys.exit(1)

    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"[*] 正在解析檔案: {input_path} ...")
    questions = parse_quiz_text(content)
    print(f"[+] 共成功識別出 {len(questions)} 道題目")

    # 執行嚴格格式檢核
    errors, warnings = validate_questions(questions)

    if warnings:
        print(f"\n[提示] 格式優化建議 ({len(warnings)} 項):")
        for w in warnings[:5]:
            print(f"   - {w}")
        if len(warnings) > 5:
            print(f"   ...以及其他 {len(warnings) - 5} 項")

    if errors:
        print(f"\n[嚴重錯誤] 嚴格檢核未通過！發現 {len(errors)} 處格式瑕疵（將導致 ee-Class 匯入或評分失敗）:")
        for e in errors:
            print(f"   [X] {e}")

        if not args.no_strict:
            print("\n[阻擋通知] 依據【嚴格防呆機制】，系統已阻擋檔案匯出！請修正上述問題題目後再執行。")
            print("[提示] 若欲強制匯出（不建議），可加上 --no-strict 參數。")
            sys.exit(1)
        else:
            print("\n[警告] 您已啟用 --no-strict，將強制產生檔案（請注意 ee-Class 可能會匯入失敗或無法評分）！")

    out_file = args.output
    if not out_file:
        out_file = f"eeClass_output.{args.format}"

    if args.format == "csv":
        export_eeclass_csv(questions, out_file)
        print(f"\n[成功] 已匯出 ee-Class CSV 檔案: {out_file} (UTF-8 BOM, 27 欄逗號分隔, Version 4 官方規範)")
    else:
        export_gift(questions, out_file)
        print(f"\n[成功] 已匯出 GIFT 格式檔案: {out_file}")

if __name__ == "__main__":
    main()

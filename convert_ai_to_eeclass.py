#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ee-Class 智慧題目轉換器 (Command Line Interface) - Pro 2026
整合 Tools_QB 題庫轉換架構，全面支援 5 大完整題型、類別、Word (.docx) 抽取與 Big5 雙編碼輸出

支援題型:
  1. 是非題 (True/False, 1=是, 2=否)
  2. 單選題 (Single Choice, 1..N)
  3. 複選題 (Multiple Choice, 多選如 "1,2,4")
  4. 填充題 (Fill-in, 題幹內嵌 [*答案*], 支援大小寫與順序選項)
  5. 問答題 / 簡答題 (Essay, 參考答案)

使用方式:
    # 支援直接輸入 Word 考題檔 (.docx) 或純文字檔 (.txt, .md)
    python convert_ai_to_eeclass.py exam.docx -o output.csv --category "環境微生物學" --big5
    python convert_ai_to_eeclass.py input.txt --format gift -o output.gift
"""

import sys
import os
import re
import csv
import io
import argparse
import unicodedata
import zipfile
from xml.etree import ElementTree as ET
from pathlib import Path

# 強制 Windows 終端機使用 UTF-8 編碼
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ee-Class 標準欄位名稱 (Row 2 Header - 27 欄)
EECLASS_HEADERS = [
    '題組 (格式相容欄位，題庫不支援)',
    '類別 (匯入線上測驗時不支援)',
    '題型: \n(1)是非\n(2)單選  \n(3)複選  \n(4)填充 \n(5)問答',
    '題目',
    '答案\n若為是非題: \n(1)答案為是\n(2)答案為否',
    '解說\n(說明沒有解說)',
    '難易度:\n(1)容易\n(2)適中\n(3)困難',
    '選項1\n若為填充題: \n(1)不分英文大小寫\n(2)區分英文大小寫',
    '選項2 \n若為填充題: \n(1)不考慮順序\n(2)需考慮順序 ',
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

# Big5 友善替換字元表
BIG5_REMAP = {
    "\u2265": "\u2267",  # ≥ -> ≧
    "\u2264": "\u2266",  # ≤ -> ≦
    "\u30fb": "\u2027",  # ・ -> ‧
}

W_NAMESPACE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

def extract_text_from_docx(docx_path: str) -> str:
    """從 Word (.docx) 檔案直接抽取所有段落純文字"""
    with zipfile.ZipFile(docx_path) as zf:
        xml_content = zf.read("word/document.xml")
    root = ET.fromstring(xml_content)
    body = root.find(W_NAMESPACE + "body")
    if body is None:
        return ""
    lines = []
    for para in body.iter(W_NAMESPACE + "p"):
        text = "".join(node.text or "" for node in para.iter(W_NAMESPACE + "t"))
        lines.append(text)
    return "\n".join(lines)

def normalize_text(text: str) -> str:
    """全形英數轉半形，清理 markdown 標記"""
    if not text:
        return ""
    normalized = unicodedata.normalize('NFKC', text)
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

def parse_multi_choice_answer(ans_str: str) -> str:
    """解析複選題答案 -> 逗號分隔字串，例如 '1,2,4'"""
    if not ans_str:
        return ""
    clean = ans_str.strip().upper()
    letters = re.findall(r'[A-T]', clean)
    if letters:
        nums = [ord(ch) - ord('A') + 1 for ch in letters]
        unique = sorted(list(set(nums)))
        return ",".join(str(n) for n in unique)
    numbers = re.findall(r'\b([1-9]|1\d|20)\b', clean)
    if numbers:
        nums = [int(n) for n in numbers]
        unique = sorted(list(set(nums)))
        return ",".join(str(n) for n in unique)
    return ""

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
    """分割單行多選項"""
    matches = list(re.finditer(r'(?:^|\s+)(?:[（(\[]([A-Ha-h1-6])[）)\]]|([A-Ha-h])[.、．])\s*', line))
    if len(matches) < 2:
        return None
    prefix = line[:matches[0].start()].strip()
    options = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        opt_text = line[start:end].strip()
        raw_letter = (m.group(1) or m.group(2)).upper()
        if re.match(r'^[1-6]$', raw_letter):
            raw_letter = chr(ord('A') + int(raw_letter) - 1)
        options.append({'letter': raw_letter, 'text': opt_text})
    return {'prefix': prefix, 'options': options}

def parse_answer_table_block(table_lines):
    """解析解答表區塊，支援 CSV 兩欄/四欄或編號格式"""
    answers = {}
    for line in table_lines:
        trimmed = line.strip()
        if not trimmed or '題號' in trimmed or '解答表' in trimmed:
            continue
        try:
            reader = csv.reader(io.StringIO(trimmed))
            for row in reader:
                for k in range(0, len(row), 2):
                    if k + 1 < len(row):
                        q_str = row[k].strip()
                        ans_str = row[k+1].strip()
                        if q_str.isdigit():
                            m = re.match(r'^\s*([A-Da-dOX1-4])', ans_str)
                            if m:
                                answers[int(q_str)] = m.group(1).upper()
        except Exception:
            pass

        if not answers:
            matches = re.finditer(r'(?:^|[,\s])(\d+)[.、．:\s,]+"?([A-Da-dOX1-4])', trimmed)
            for m in matches:
                q_num = int(m.group(1))
                if q_num not in answers:
                    answers[q_num] = m.group(2).upper()
    return answers

def normalize_freeform_quiz_text(raw_text: str):
    """將自由排版考題（如 SDGs 題庫、Word 考卷、無序號或併排選項）規格化為標準期待格式"""
    if not raw_text or not raw_text.strip():
        return raw_text, ""

    text = unicodedata.normalize('NFKC', raw_text)
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\r', '\n', text)
    text = re.sub(r'\*\*', '', text)
    text = re.sub(r'`', '', text)

    lines = text.split('\n')
    output_lines = []
    detected_category = ""
    in_intro = True
    current_section = None
    section_q_indices = {}  # q_num -> index in output_lines

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            output_lines.append("")
            i += 1
            continue

        # 1. 過濾試卷結尾雜訊或延伸建議
        if re.match(r'^(?:🌱\s*後續延伸建議|※?\s*備註|以上題目由|Note:|Hope this helps)', line, re.IGNORECASE):
            break

        # 2. 章節 / 類別標題識別（如 📘 2.1 SDGs介紹（15題）或 第2章 ...）
        is_chapter = bool(re.match(r'^(?:[📘📗📕📙]+|(?:第[一二三四五六七八九十0-9]+[章單單元節])|(?:\d+\.\d+))\s*(.*)$', line))
        if is_chapter and not re.match(r'^\d+[.、．]', line):
            in_intro = False
            clean_cat = re.sub(r'^[📘📗📕📙\s]+|[（(]\d+題[）)]\s*$', '', line).strip()
            if len(clean_cat) >= 2 and not re.match(r'^[一二三四五六七八九十0-9]+[、.．\s]+(?:單選|是非|選擇|複選|填|問答|解答)', clean_cat):
                section_q_indices = {}  # 重置章節題號索引
                if not detected_category:
                    detected_category = clean_cat
                output_lines.append(f"\n[類別：{clean_cat}]")
                i += 1
                continue

        # 3. 過濾試卷資訊雜訊或 AI 說明前言
        if in_intro:
            if re.match(r'^(?:國立|私立|市立|縣立|臺灣|台灣|.*大學|.*學校|.*高中|.*學年度|.*學期|考試時間|測驗時間|時間|姓名|學號|座號|班級|得分|成績|教師|批改|※?\s*作答說明|第\s*\d+\s*頁).*$', line, re.IGNORECASE) or \
               re.search(r'(?:已為您|以下為|題目如下|共計\s*\d+\s*題|來源資料|排除非關|聚焦於)', line):
                i += 1
                continue

        # 4. 考卷前置主旨識別（若在題前出現）
        topic_match = re.search(r'(?:課程|測驗|題庫|考卷|目標)[：:\s]*(.*(?:SDGs|永續發展|環境|通識|基礎|生物|化學|工程|資訊|管理|概論).*)', line, re.IGNORECASE) or \
                      re.search(r'(.*(?:SDGs|永續發展).*)', line, re.IGNORECASE)
        if in_intro and topic_match and not detected_category:
            clean_cat = re.sub(r'(?:期末|期中|核心素養|測驗|題庫|考卷|試卷|考試|核心能力)', '', topic_match.group(1)).strip(' ：:\t')
            if len(clean_cat) >= 2 and not re.match(r'^(?:已為您|以下為)', clean_cat):
                detected_category = clean_cat

        # 5. 大題題型標頭識別與標準化
        if re.search(r'^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:是非[判斷對錯]*題|判斷題|對錯題).*?】?$', line):
            in_intro = False
            current_section = 'TF'
            output_lines.append("\n一、是非題")
            i += 1
            continue
        if re.search(r'^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:單選[測驗選擇]*題|單一選擇題|選擇題).*?】?$', line):
            in_intro = False
            current_section = 'SINGLE'
            output_lines.append("\n二、單選題")
            i += 1
            continue
        if re.search(r'^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:複選[測驗多重]*題|多選題|多重選擇題).*?】?$', line):
            in_intro = False
            current_section = 'MULTI'
            output_lines.append("\n三、複選題")
            i += 1
            continue
        if re.search(r'^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:填[充空]+題).*?】?$', line):
            in_intro = False
            current_section = 'FILL'
            output_lines.append("\n四、填充題")
            i += 1
            continue
        if re.search(r'^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:問答題|簡答題|申論題|計算題).*?】?$', line):
            in_intro = False
            current_section = 'ESSAY'
            output_lines.append("\n五、問答題")
            i += 1
            continue

        # 6. 集中解答表識別（支援插入於卷中或卷末的 CSV/文字表格）
        is_ans_table_header = bool(re.search(r'^(?:【\s*(?:解答|參考解答|標準答案|全卷解答|Answer Key)\s*】|(?:解答|參考解答|標準答案|全卷解答|Answer Key)[：:\s]*|(?:[一二三四五六七八九十0-9]+[、.．\s]+)?(?:解答表|參考解答|標準答案|全卷解答|Answer Key).*)$', line, re.IGNORECASE))
        is_csv_ans_table = ('題號' in line and '答案' in line) or bool(re.match(r'^\d+\s*,\s*\"?[A-Da-dOX1-4]', line))

        if is_ans_table_header or is_csv_ans_table:
            table_lines = []
            if not is_ans_table_header:
                table_lines.append(line)
            i += 1
            while i < len(lines):
                next_line = lines[i].strip()
                if not next_line:
                    i += 1
                    continue
                if '題號' in next_line and '答案' in next_line:
                    table_lines.append(next_line)
                    i += 1
                    continue
                if re.match(r'^\d+\s*,\s*\"?[A-Da-dOX1-4]', next_line) or re.match(r'^\d+[.、．:\s]+[A-Da-dOX1-4]', next_line):
                    table_lines.append(next_line)
                    i += 1
                else:
                    break

            table_answers = parse_answer_table_block(table_lines)
            inserts = []

            for q_num, ans_val in table_answers.items():
                if q_num in section_q_indices:
                    q_idx = section_q_indices[q_num]
                    insert_pos = q_idx + 1
                    while insert_pos < len(output_lines):
                        cur_l = output_lines[insert_pos]
                        if re.match(r'^\d+[.、．]', cur_l) or cur_l.startswith('[類別：') or cur_l.startswith('\n'):
                            break
                        insert_pos += 1
                    inserts.append((insert_pos, f"答案：{ans_val}"))

            inserts.sort(key=lambda x: x[0], reverse=True)
            for pos, ans_line in inserts:
                output_lines.insert(pos, ans_line)

            continue

        # 7. 檢查是否為新題目開頭（包含題首帶答案模式）
        lead_ans_match = re.match(r'^[（(\[]\s*([A-Ha-hO○⭕X╳✕✘F是丵否對錯1-6])\s*[）)\]]\s*(?:第?\s*(\d+)\s*題?|\d+)[.、．:：\s]+(.*)$', line, re.IGNORECASE)
        num_lead_match = re.match(r'^(?:第?\s*(\d+)\s*題?|(\d+))[.、．:：\s]+[（(\[]\s*([A-Ha-hO○⭕X╳✕✘F是丵否對錯1-6])\s*[）)\]][.、．\s]*(.*)$', line, re.IGNORECASE)
        standard_q_match = re.match(r'^(?:第?\s*(\d+)\s*題?|(\d+)|【\s*(\d+)\s*】|[（(]\s*(\d+)\s*[）)])[.、．:：\s]+(.*)$', line, re.IGNORECASE)

        if lead_ans_match:
            in_intro = False
            current_q_num = int(lead_ans_match.group(2))
            ans = lead_ans_match.group(1).upper()
            if current_section == 'TF' or ans in 'OXTF是否對錯12':
                ans = 'O' if ans in '1OT是丵對' else 'X'
            section_q_indices[current_q_num] = len(output_lines)
            output_lines.append(f"{current_q_num}. {lead_ans_match.group(3).strip()}")
            output_lines.append(f"答案：{ans}")
            i += 1
            continue
        elif num_lead_match:
            in_intro = False
            current_q_num = int(num_lead_match.group(1) or num_lead_match.group(2))
            ans = num_lead_match.group(3).upper()
            if current_section == 'TF' or ans in 'OXTF是否對錯12':
                ans = 'O' if ans in '1OT是丵對' else 'X'
            section_q_indices[current_q_num] = len(output_lines)
            output_lines.append(f"{current_q_num}. {num_lead_match.group(4).strip()}")
            output_lines.append(f"答案：{ans}")
            i += 1
            continue
        elif standard_q_match:
            q_digits = standard_q_match.group(1) or standard_q_match.group(2) or standard_q_match.group(3) or standard_q_match.group(4)
            is_likely_option = bool(re.match(r'^[（(]\s*[1-6]\s*[）)]', line) and (current_section in ['SINGLE', 'MULTI']))
            if not is_likely_option:
                in_intro = False
                current_q_num = int(q_digits)
                section_q_indices[current_q_num] = len(output_lines)

        # 檢查題尾答案
        tail_ans = re.match(r'^(.*?)\s*[（(]\s*([A-Ha-hO○⭕X╳✕✘F是丵否對錯1-6])\s*[）)]\s*$', line, re.IGNORECASE)
        if tail_ans and not re.match(r'^\s*(?:答案|解析)', line):
            stem = tail_ans.group(1).strip()
            ans = tail_ans.group(2).upper()
            if current_section == 'TF' or ans in 'OXTF是否對錯12':
                ans = 'O' if ans in '1OT是丵對' else 'X'
            output_lines.append(stem)
            output_lines.append(f"答案：{ans}")
            i += 1
            continue

        # 8. 填充題格式自動對齊
        if current_section == 'FILL' or re.search(r'(?:_{2,}|________+|（\s*）|\(\s*\))[（(]\s*[^()]+?\s*[）)]', line):
            line = re.sub(r'(?:_{2,}|________+|（\s*）|\(\s*\))[（(]\s*([^()]+?)\s*[）)]', r'[*\1*]', line)
            if current_section == 'FILL':
                def repl_bracket(m):
                    content = m.group(1)
                    if re.search(r'是非|單選|選擇|複選|多選|填[充空]|問答|簡答|解析|說明|詳解|答案', content):
                        return m.group(0)
                    return f"[*{content}*]"
                line = re.sub(r'【\s*([^【】\n]+?)\s*】', repl_bracket, line)

        # 9. 答案行
        ans_key_match = re.match(r'^(?:【\s*(?:正確答案|答案|Ans|Answer|Key|正解|解答)\s*】|正確答案|答案|Ans|Answer|Key|正解|解答|答案是)[：:\s]*(.+)$', line, re.IGNORECASE)
        if ans_key_match:
            raw_ans = ans_key_match.group(1).strip()
            if current_section == 'MULTI':
                raw_ans = re.sub(r'[、\s]+', ', ', raw_ans)
                raw_ans = re.sub(r'[,，]+', ', ', raw_ans)

            if re.match(r'^[1-6]$', raw_ans) and current_section != 'TF':
                raw_ans = chr(ord('A') + int(raw_ans) - 1)
            elif current_section == 'TF':
                raw_ans = 'O' if raw_ans in '1OT是丵對' else 'X'

            inline_exp = re.match(r'^(.*?)(?:[；;，,]\s*|\s+)(?:【?(?:解析|詳解|說明|解說|Rationale|Explanation)】?)[：:\s]*(.*)$', raw_ans, re.IGNORECASE)
            if inline_exp:
                output_lines.append(f"答案：{inline_exp.group(1).strip()}")
                if inline_exp.group(2).strip():
                    output_lines.append(f"解析：{inline_exp.group(2).strip()}")
            else:
                output_lines.append(f"答案：{raw_ans}")
            i += 1
            continue

        # 10. 解析行
        exp_match = re.match(r'^(?:【\s*(?:解析|詳解|說明|解說|Rationale|Explanation)\s*】|解析|詳解|說明|解說|Rationale|Explanation)[：:\s]*(.*)$', line, re.IGNORECASE)
        if exp_match:
            output_lines.append(f"解析：{exp_match.group(1).strip()}")
            i += 1
            continue

        # 11. 同一行多選項拆分（包含附帶來源引用與無空格黏合選項）
        # 例如: 1(A) 優先滿足... (B) ... 1(C) ... (D) ...
        opt_matches = list(re.finditer(r'(?:(?:\s*\d+(?:,\s*\d+)*)?\s*|^)(?:[（(\[]([A-Ha-h1-6])[）)\]]|(?:^|\s+)([A-Ha-h])[.、．](?![A-Za-z])|([①②③④⑤⑥]))\s*', line))
        if len(opt_matches) >= 2:
            prefix = line[:opt_matches[0].start()].strip()
            prefix = re.sub(r'\s*\d+(?:,\s*\d+)*\s*$', '', prefix)
            if prefix:
                output_lines.append(prefix)
            for k, cur in enumerate(opt_matches):
                nxt = opt_matches[k+1].start() if k + 1 < len(opt_matches) else len(line)
                opt_txt = line[cur.end():nxt].strip()
                opt_txt = re.sub(r'\s*\d+(?:,\s*\d+)*\s*$', '', opt_txt)
                lbl = cur.group(1) or cur.group(2) or cur.group(3)
                if lbl in '①②③④⑤⑥':
                    lbl = chr(ord('A') + '①②③④⑤⑥'.index(lbl))
                elif re.match(r'^[1-6]$', lbl):
                    lbl = chr(ord('A') + int(lbl) - 1)
                else:
                    lbl = lbl.upper()
                output_lines.append(f"({lbl}) {opt_txt}")
            i += 1
            continue

        # 12. 單一獨立選項
        single_opt = re.match(r'^(?:[（(\[]([A-Ha-h1-6])[）)\]]|([A-Ha-h])[.、．]|([①②③④⑤⑥]))\s*(.*)$', line)
        if single_opt and (current_section in ['SINGLE', 'MULTI'] or re.match(r'^[A-Ha-h①②③④⑤⑥]', line)):
            lbl = single_opt.group(1) or single_opt.group(2) or single_opt.group(3)
            if lbl in '①②③④⑤⑥':
                lbl = chr(ord('A') + '①②③④⑤⑥'.index(lbl))
            elif re.match(r'^[1-6]$', lbl):
                lbl = chr(ord('A') + int(lbl) - 1)
            else:
                lbl = lbl.upper()
            opt_txt = single_opt.group(4).strip()
            opt_txt = re.sub(r'\s*\d+(?:,\s*\d+)*\s*$', '', opt_txt)
            output_lines.append(f"({lbl}) {opt_txt}")
            i += 1
            continue

        output_lines.append(line)
        i += 1

    normalized_text = re.sub(r'\n{3,}', '\n\n', "\n".join(output_lines)).strip()
    return normalized_text, detected_category

def parse_quiz_text(raw_text: str, default_section_type=None, auto_normalize=True):
    """解析題目文字，支援 5 大題型、類別標註與自由格式自動規格化"""
    if not raw_text or not raw_text.strip():
        return []

    current_category = ""
    if auto_normalize:
        norm_text, det_cat = normalize_freeform_quiz_text(raw_text)
        raw_text = norm_text
        if det_cat:
            current_category = det_cat

    normalized = normalize_text(raw_text)
    lines = normalized.split('\n')
    questions = []

    current_section = default_section_type
    raw_blocks = []
    current_block = []

    lead_number_pattern = re.compile(r'^(Q\s*\d+|第\s*\d+\s*題|\d+|【\s*\d+\s*】|[（(]\s*\d+\s*[）)])[.、．:：\s]*', re.IGNORECASE)

    def check_header(line_text: str):
        trimmed = line_text.strip()
        cat_match = re.search(r'^(?:#+\s*|[【\[])?(?:類別|章節|單元|章)[：:\s]+(.+?)[】\]]?$', trimmed, re.IGNORECASE) or \
                    re.search(r'^#+\s*(第[一二三四五六七八九十0-9]+[章節單元][\s\S]*)$', trimmed, re.IGNORECASE)
        if cat_match:
            return ('CATEGORY', cat_match.group(1).strip())

        if re.search(r'^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(是非題|判斷題|對錯題)', trimmed) or re.search(r'^【?(是非題|判斷題|對錯題)】?$', trimmed):
            return ('SECTION', 1)
        if re.search(r'^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(單選題|選擇題)', trimmed) or re.search(r'^【?(單選題|選擇題)】?$', trimmed):
            return ('SECTION', 2)
        if re.search(r'^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(複選題|多選題)', trimmed) or re.search(r'^【?(複選題|多選題)】?$', trimmed):
            return ('SECTION', 3)
        if re.search(r'^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(填充題|填空題)', trimmed) or re.search(r'^【?(填充題|填空題)】?$', trimmed):
            return ('SECTION', 4)
        if re.search(r'^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(問答題|簡答題|申論題)', trimmed) or re.search(r'^【?(問答題|簡答題|申論題)】?$', trimmed):
            return ('SECTION', 5)
        return None

    def is_q_start(line_text: str) -> bool:
        trimmed = line_text.strip()
        if re.match(r'^[（(\[]?[A-Ha-h][）)\]][.、．\s]', trimmed): return False
        if re.match(r'^[A-Ha-h][.、．\s]', trimmed): return False
        if re.match(r'^[（(\[]\s*[1-6]\s*[）\]]', trimmed): return False
        if lead_number_pattern.match(trimmed): return True
        if re.match(r'^\[(單選|是非|選擇|複選|多選|填充|問答|簡答)\]', trimmed): return True
        return False

    for line in lines:
        trimmed = line.strip()
        h_info = check_header(trimmed)
        if h_info is not None:
            if current_block:
                raw_blocks.append({'section': current_section, 'category': current_category, 'lines': current_block})
                current_block = []
            if h_info[0] == 'CATEGORY':
                current_category = h_info[1]
            elif h_info[0] == 'SECTION':
                current_section = h_info[1]
            continue

        if is_q_start(trimmed):
            if current_block:
                raw_blocks.append({'section': current_section, 'category': current_category, 'lines': current_block})
                current_block = []

        if trimmed or current_block:
            current_block.append(line)

    if current_block:
        raw_blocks.append({'section': current_section, 'category': current_category, 'lines': current_block})

    for idx, block in enumerate(raw_blocks, 1):
        q = parse_single_block(block['lines'], block['section'], block['category'], idx)
        if q:
            questions.append(q)

    return questions

def parse_single_block(lines, section_type, default_category, default_idx):
    if not lines:
        return None

    question_text = ""
    options = []
    answer_raw = ""
    explanation = ""
    category = default_category or ""
    difficulty = 2
    explicit_type = section_type
    case_sensitive = 1
    ordered = 1

    lead_number_pattern = re.compile(r'^(Q\s*\d+|第\s*\d+\s*題|\d+|【\s*\d+\s*】|[（(]\s*\d+\s*[）)])[.、．:：\s]*', re.IGNORECASE)
    state = 'QUESTION'

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        tag_match = re.match(r'^(\[(單選|選擇|是非|判斷|複選|多選|填充|填空|問答|簡答|申論)\]|【(單選|選擇|是非|判斷|複選|多選|填充|填空|問答|簡答|申論)】)\s*', line_clean, re.IGNORECASE)
        if tag_match:
            name = tag_match.group(2) or tag_match.group(3)
            if name in ['單選', '選擇']: explicit_type = 2
            elif name in ['是非', '判斷']: explicit_type = 1
            elif name in ['複選', '多選']: explicit_type = 3
            elif name in ['填充', '填空']: explicit_type = 4
            elif name in ['問答', '簡答', '申論']: explicit_type = 5
            line_clean = line_clean[tag_match.end():].strip()

        cat_inline = re.search(r'(?:\[|【)?(?:類別|章節|單元)[：:\s]+([^\]】\n]+)(?:\]|】)?', line_clean, re.IGNORECASE)
        if cat_inline:
            category = cat_inline.group(1).strip()
            line_clean = line_clean[:cat_inline.start()].strip() + " " + line_clean[cat_inline.end():].strip()
            line_clean = line_clean.strip()
            if not line_clean:
                continue

        diff_match = re.search(r'(?:難易度|難度|Difficulty)[：:\s]*([^\n,，]+)', line_clean, re.IGNORECASE)
        if diff_match:
            difficulty = parse_difficulty(diff_match.group(1))
            line_clean = line_clean[:diff_match.start()].strip() + " " + line_clean[diff_match.end():].strip()
            line_clean = line_clean.strip()
            if not line_clean:
                continue

        ans_match = re.match(r'^(?:正確答案|答案|Ans|Answer|Key)[：:\s]*(.+)$', line_clean, re.IGNORECASE)
        if ans_match:
            state = 'ANSWER'
            remaining = ans_match.group(1).strip()
            if re.search(r'區分大小寫|區分英文大小寫', remaining, re.IGNORECASE): case_sensitive = 2
            if re.search(r'需考慮順序|考慮順序', remaining, re.IGNORECASE): ordered = 2

            inline_exp = re.search(r'^(.*?)(?:[；;，,]\s*|\s+)(?:解析|詳解|說明|解說|Rationale|Explanation)[：:\s]*(.*)$', remaining, re.IGNORECASE)
            if inline_exp:
                answer_raw = inline_exp.group(1).strip()
                explanation = inline_exp.group(2).strip()
                state = 'EXPLANATION'
            else:
                answer_raw = remaining
            continue

        exp_match = re.match(r'^(?:解析|詳解|說明|解說|Rationale|Explanation)[：:\s]*(.*)$', line_clean, re.IGNORECASE)
        if exp_match:
            state = 'EXPLANATION'
            explanation = (explanation + "\n" if explanation else "") + exp_match.group(1).strip()
            continue

        if state == 'EXPLANATION':
            explanation = (explanation + "\n" if explanation else "") + line_clean
            continue

        inline_data = split_inline_options(line_clean)
        if inline_data and len(inline_data['options']) >= 2:
            if state == 'QUESTION' and inline_data['prefix']:
                pfx = lead_number_pattern.sub('', inline_data['prefix']).strip()
                if pfx:
                    question_text = (question_text + "\n" + pfx) if question_text else pfx
            state = 'OPTIONS'
            options.extend(inline_data['options'])
            continue

        opt_match = re.match(r'(?:^|(.*?)\s+)(?:[（(\[]([A-Ha-h1-6])[）)\]]|([A-Ha-h])[.、．])\s*(.*)$', line_clean)
        if opt_match:
            prefix = (opt_match.group(1) or '').strip()
            raw_letter = (opt_match.group(2) or opt_match.group(3)).upper()
            if re.match(r'^[1-6]$', raw_letter):
                raw_letter = chr(ord('A') + int(raw_letter) - 1)
            opt_text = (opt_match.group(4) or '').strip()
            if state == 'QUESTION' and prefix:
                pfx = lead_number_pattern.sub('', prefix).strip()
                if pfx:
                    question_text = (question_text + "\n" + pfx) if question_text else pfx
            state = 'OPTIONS'
            options.append({'letter': raw_letter, 'text': opt_text})
            continue

        if state == 'OPTIONS' and options:
            options[-1]['text'] += " " + line_clean
            continue

        if state == 'QUESTION':
            if not question_text:
                clean_stem = lead_number_pattern.sub('', line_clean).strip()
                lead_tf = re.match(r'^[（(]([O○⭕TX╳✕✘F是丵否對錯])[）)][\s、.．]*(.*)$', clean_stem, re.IGNORECASE)
                if lead_tf:
                    explicit_type = 1
                    if not answer_raw: answer_raw = lead_tf.group(1)
                    clean_stem = lead_tf.group(2).strip()

                tail_tf = re.match(r'^(.*?)\s*[（(]([O○⭕TX╳✕✘F是丵否對錯])[）)]\s*$', clean_stem, re.IGNORECASE)
                if tail_tf and not answer_raw:
                    explicit_type = 1
                    answer_raw = tail_tf.group(2)
                    clean_stem = tail_tf.group(1).strip()
                question_text = clean_stem
            else:
                question_text += "\n" + line_clean

    question_text = question_text.strip()
    explanation = explanation.strip()

    # 判斷題型
    q_type = explicit_type
    if not q_type:
        if re.search(r'\[\*([^*]+)\*\]', question_text):
            q_type = 4
        elif len(options) >= 2:
            if parse_multi_choice_answer(answer_raw).count(',') > 0 or re.search(r'[A-T]{2,}', answer_raw, re.IGNORECASE):
                q_type = 3
            else:
                q_type = 2
        elif parse_tf_answer(answer_raw) is not None or re.search(r'^(是|否|O|X|True|False)$', answer_raw, re.IGNORECASE):
            q_type = 1
        elif answer_raw and len(options) == 0:
            q_type = 5
        else:
            q_type = 2 if options else 1

    # 填充題自動替換 ______ 為 [*答案*]
    if q_type == 4 and not re.search(r'\[\*([^*]+)\*\]', question_text):
        if answer_raw and re.search(r'(_{2,}|（\s*）|\(\s*\)|【\s*】)', question_text):
            parts = re.split(r'[,，、\s]+', answer_raw)
            p_idx = 0
            def repl(m):
                nonlocal p_idx
                ans = parts[p_idx] if p_idx < len(parts) else ""
                p_idx += 1
                return f"[*{ans.strip()}*]"
            question_text = re.sub(r'(_{2,}|（\s*）|\(\s*\)|【\s*】)', repl, question_text)

    # 處理答案代碼
    final_answer = None
    if q_type == 1:
        final_answer = parse_tf_answer(answer_raw)
    elif q_type == 2:
        final_answer = parse_choice_answer(answer_raw)
    elif q_type == 3:
        final_answer = parse_multi_choice_answer(answer_raw)
    elif q_type == 4:
        final_answer = ""
    elif q_type == 5:
        final_answer = answer_raw

    return {
        'index': default_idx,
        'type': q_type,
        'category': category,
        'stem': question_text,
        'options': [o['text'] for o in options],
        'answer': final_answer,
        'explanation': explanation,
        'difficulty': difficulty,
        'case_sensitive': case_sensitive,
        'ordered': ordered
    }

def validate_questions(questions: list):
    """嚴格防呆檢核"""
    issues = []
    if not questions:
        return {'is_valid': False, 'issues': [{'message': '沒有找到任何題目。'}]}

    for q in questions:
        q_idx = q['index']
        if not q['stem']:
            issues.append(f"第 {q_idx} 題：題幹為空。")

        if q['type'] == 1:
            if q['answer'] not in [1, 2]:
                issues.append(f"第 {q_idx} 題（是非題）：缺少正確答案 (1=是, 2=否)。")
        elif q['type'] == 2:
            if len(q['options']) < 2:
                issues.append(f"第 {q_idx} 題（單選題）：選項少於 2 個。")
            if not q['answer'] or q['answer'] < 1 or q['answer'] > len(q['options']):
                issues.append(f"第 {q_idx} 題（單選題）：答案代碼無效或超出選項範圍。")
        elif q['type'] == 3:
            if len(q['options']) < 2:
                issues.append(f"第 {q_idx} 題（複選題）：選項少於 2 個。")
            if not q['answer']:
                issues.append(f"第 {q_idx} 題（複選題）：未指定正確答案。")
        elif q['type'] == 4:
            if not re.search(r'\[\*([^*]+)\*\]', q['stem']):
                issues.append(f"第 {q_idx} 題（填充題）：題幹內缺少 [*空格答案*] 標記。")

    return {'is_valid': len(issues) == 0, 'issues': issues}

def generate_csv_rows(questions: list, global_category: str = "") -> list:
    """產出 27 欄 CSV 資料列"""
    rows = []
    # Row 1
    row1 = ['version: 4'] + [''] * 26
    rows.append(row1)
    # Row 2 Header
    rows.append(EECLASS_HEADERS)

    for q in questions:
        row = [''] * 27
        row[0] = '' # 題組
        row[1] = q.get('category') or global_category or '' # 類別
        q_type = q.get('type', 2)
        row[2] = str(q_type)
        row[3] = q.get('stem', '')

        # 答案
        if q_type == 1:
            row[4] = str(q.get('answer', ''))
        elif q_type == 2:
            row[4] = str(q.get('answer', ''))
        elif q_type == 3:
            row[4] = str(q.get('answer', '')).strip()
        elif q_type == 4:
            row[4] = '' # 填充題官方留空
        elif q_type == 5:
            row[4] = str(q.get('answer', ''))

        row[5] = q.get('explanation', '')
        row[6] = str(q.get('difficulty', 2))

        # 選項 1~20
        if q_type in [2, 3]:
            opts = q.get('options', [])
            for i in range(20):
                row[7 + i] = opts[i] if i < len(opts) else ''
        elif q_type == 4:
            row[7] = str(q.get('case_sensitive', 1))
            row[8] = str(q.get('ordered', 1))
            for i in range(2, 20):
                row[7 + i] = ''
        else:
            for i in range(20):
                row[7 + i] = ''

        rows.append(row)
    return rows

def remap_for_big5(text: str) -> str:
    """Big5 字元等義修復"""
    for src, dst in BIG5_REMAP.items():
        text = text.replace(src, dst)
    return text

def write_csv(filepath: Path, rows: list, with_bom: bool = True):
    """寫入 RFC 4180 標準逗號分隔 CSV"""
    encoding = 'utf-8-sig' if with_bom else 'utf-8'
    with open(filepath, 'w', encoding=encoding, newline='') as f:
        writer = csv.writer(f, delimiter=',', quoting=csv.QUOTE_MINIMAL)
        for r in rows:
            writer.writerow(r)

def write_big5_csv(filepath: Path, rows: list):
    """寫入 Big5 副本 CSV (CP950)"""
    with open(filepath, 'w', encoding='cp950', errors='replace', newline='') as f:
        writer = csv.writer(f, delimiter=',', quoting=csv.QUOTE_MINIMAL)
        for r in rows:
            mapped_row = [remap_for_big5(str(cell)) for cell in r]
            writer.writerow(mapped_row)

def generate_gift(questions: list, global_category: str = "") -> str:
    """產出 GIFT 格式字串"""
    output = "// GIFT Format exported for ee-class\n\n"
    if global_category:
        output += f"$CATEGORY: {global_category}\n\n"

    for idx, q in enumerate(questions, 1):
        clean_stem = re.sub(r'[{}=~#]', r'\\\g<0>', q['stem'] or '')
        clean_exp = re.sub(r'[{}=~#]', r'\\\g<0>', q['explanation'] or '')
        feedback = f"#{clean_exp}" if clean_exp else ""

        if q['type'] == 1:
            tf = "TRUE" if q['answer'] == 1 else "FALSE"
            output += f"::Q{idx}:: {clean_stem} {{{tf}{feedback}}}\n\n"
        elif q['type'] == 2:
            output += f"::Q{idx}:: {clean_stem} {{\n"
            ans_idx = int(q['answer']) if q['answer'] else 0
            for opt_i, opt in enumerate(q.get('options', []), 1):
                clean_opt = re.sub(r'[{}=~#]', r'\\\g<0>', opt)
                prefix = '=' if opt_i == ans_idx else '~'
                fb = feedback if opt_i == ans_idx else ""
                output += f"    {prefix}{clean_opt}{fb}\n"
            output += "}\n\n"
        elif q['type'] == 3:
            output += f"::Q{idx}:: {clean_stem} {{\n"
            correct_nums = [int(n) for n in str(q['answer']).split(',') if n.strip().isdigit()]
            pos_w = f"{(100/len(correct_nums)):.2f}" if correct_nums else "50.00"
            wrong_count = len(q.get('options', [])) - len(correct_nums)
            neg_w = f"{(-100/wrong_count):.2f}" if wrong_count > 0 else "-50.00"
            for opt_i, opt in enumerate(q.get('options', []), 1):
                clean_opt = re.sub(r'[{}=~#]', r'\\\g<0>', opt)
                w = f"%{pos_w}%" if opt_i in correct_nums else f"%{neg_w}%"
                fb = feedback if opt_i in correct_nums else ""
                output += f"    ~{w}{clean_opt}{fb}\n"
            output += "}\n\n"
        elif q['type'] == 4:
            def gift_blank(m):
                ans = re.sub(r'[{}=~#]', r'\\\g<0>', m.group(1).strip())
                return f"{{={ans}{feedback}}}"
            g_stem = re.sub(r'\[\*([^*]+)\*\]', gift_blank, clean_stem)
            output += f"::Q{idx}:: {g_stem}\n\n"
        elif q['type'] == 5:
            output += f"::Q{idx}:: {clean_stem} {{{feedback}}}\n\n"

    return output

def main():
    parser = argparse.ArgumentParser(description="ee-Class 智慧題目轉換器 (支援 .docx / .txt / .md / Big5 雙編碼)")
    parser.add_argument("input_file", help="輸入題目檔路徑 (支援 .docx, .txt, .md)")
    parser.add_argument("-o", "--output", help="輸出檔案路徑 (預設為同檔名 .csv)")
    parser.add_argument("--format", choices=["csv", "gift"], default="csv", help="輸出格式 (預設: csv)")
    parser.add_argument("--category", default="", help="全域題庫類別名稱 (如 '環境微生物學')")
    parser.add_argument("--big5", action="store_true", help="同時輸出 Big5 副本 CSV (檔名加上 _big5.csv)")
    parser.add_argument("--no-bom", action="store_true", help="CSV 不加上 UTF-8 BOM (預設皆帶有 BOM)")
    parser.add_argument("--no-strict", action="store_true", help="關閉嚴格檢核防呆 (不阻擋有瑕疵題目)")

    args = parser.parse_args()

    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"[X] 錯誤: 找不到輸入檔案: {input_path}")
        sys.exit(1)

    # 1. 讀取題目內容 (支援 .docx 與文字檔)
    ext = input_path.suffix.lower()
    if ext == ".docx":
        print(f"[*] 檢測到 Word 考題檔 (.docx)，正在抽取段落純文字...")
        try:
            raw_text = extract_text_from_docx(str(input_path))
        except Exception as e:
            print(f"[X] Word 檔案抽取失敗: {e}")
            sys.exit(1)
    else:
        for enc in ['utf-8-sig', 'utf-8', 'cp950', 'gbk']:
            try:
                raw_text = input_path.read_text(encoding=enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            print(f"[X] 錯誤: 無法以常見編碼讀取 {input_path}")
            sys.exit(1)

    print(f"[*] 正在進行智慧題型辨識 (支援是非、單選、複選、填充、問答 5 大題型)...")
    questions = parse_quiz_text(raw_text)

    # 2. 統計數據
    type_names = {1: '是非題', 2: '單選題', 3: '複選題', 4: '填充題', 5: '問答題'}
    counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for q in questions:
        counts[q['type']] = counts.get(q['type'], 0) + 1

    print(f"[+] 成功解析 {len(questions)} 道題目！")
    print(f"    - 是非題: {counts[1]} 題")
    print(f"    - 單選題: {counts[2]} 題")
    print(f"    - 複選題: {counts[3]} 題")
    print(f"    - 填充題: {counts[4]} 題")
    print(f"    - 問答題: {counts[5]} 題")

    # 3. 嚴格防呆檢核
    validation = validate_questions(questions)
    if not validation['is_valid']:
        print(f"\n[!] 警告: 發現以下格式或內容瑕疵:")
        for issue in validation['issues']:
            print(f"    - {issue}")
        if not args.no_strict:
            print(f"\n[X] 嚴格檢核防呆已阻擋匯出！請修復題目後再試，或加上 --no-strict 略過。")
            sys.exit(1)

    # 4. 決定輸出路徑
    out_format = args.format.lower()
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.with_suffix("." + ("gift" if out_format == "gift" else "csv"))

    # 5. 匯出檔案
    if out_format == "csv":
        csv_rows = generate_csv_rows(questions, global_category=args.category)
        write_csv(output_path, csv_rows, with_bom=not args.no_bom)
        bom_str = "UTF-8 with BOM" if not args.no_bom else "UTF-8 (no BOM)"
        print(f"\n[+] 成功匯出 ee-Class 官方標準 CSV ({bom_str}, 27 欄逗號分隔): {output_path}")

        if args.big5:
            big5_path = output_path.parent / (output_path.stem + "_big5.csv")
            write_big5_csv(big5_path, csv_rows)
            print(f"[+] 成功匯出 Big5 副本 CSV (CP950 編碼, 附符號等義修復): {big5_path}")
    else:
        gift_content = generate_gift(questions, global_category=args.category)
        output_path.write_text(gift_content, encoding='utf-8')
        print(f"\n[+] 成功匯出 GIFT 格式檔案: {output_path}")

    print("\n[*] 完工！可直接前往 ee-Class 進行考題匯入。")

if __name__ == "__main__":
    main()

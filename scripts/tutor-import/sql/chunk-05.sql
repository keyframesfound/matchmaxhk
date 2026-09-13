INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T025', 'MM-T025', 'IB Predicted 44 🏅 | UCAT 96th Percentile 🔥 | St. Stephen''s College Graduate 🩺', ARRAY['Chin B HL', 'Bio HL', 'Chem HL', 'Hist SL', 'Math AA SL', 'Eng A Lang Lit SL']::text[], 'Within Hong Kong Island', ARRAY['Sai Wan Ho']::text[], 300, NULL, false, NULL, ARRAY['English', 'Cantonese']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Chem HL"},{"grade":"7","subject":"Bio HL"},{"grade":"7","subject":"Chin B HL"},{"grade":"7","subject":"Math AA SL"},{"grade":"7","subject":"Hist SL"},{"grade":"6","subject":"Eng A Lang Lit SL"}]},{"system":"ucat","subjects":[{"grade":"2360","subject":"UCAT Total"}]}]'::jsonb, 'either', 'male', NULL, ARRAY['IBDP']::text[], '• **IB predicted 44/45** with Grade 7 predicted in Chemistry HL, Biology HL, Chinese B HL, Math AA SL & History SL 🏅

• **UCAT 2360 (96th percentile)** with medicine interview invites from Cambridge, Imperial, HKU, CUHK & Bristol 🏥

• **Top of Form** in Chemistry HL (F5 & F6) and Biology HL (F5); 98% in Chemistry HL mock exam 📊

• UCAT prep, UK/HK medicine personal statements & interview coaching; IA / EE review for sciences 📝

• English Debate Team Captain (4 years) 🗣️', '[]'::jsonb, ARRAY['IA', 'EE']::text[], NULL, 'IBDP Predicted 44/45', 'St. Stephen''s College', ARRAY['IB Predicted 44 | UCAT 96th Percentile 🧬', 'Top of Form Chem & Bio HL | 98% Chem Mock 📊', 'Med Interviews: Cambridge, Imperial, HKU 🏥']::text[]),
  ('MM-T026', 'MM-T026', 'IB 44/45 🏅 | HKU IBGM Y2 🎓 | G5 Offers (LSE / UCL / Warwick) 📊', ARRAY['Math AI HL', 'Econ HL']::text[], 'Within Hong Kong Island', ARRAY['Central', 'Sheung Wan']::text[], 450, 'HKU IBGM', true, 2, ARRAY['English', 'Cantonese']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Math AI HL"},{"grade":"7","subject":"Econ HL"}]}]'::jsonb, 'either', 'male', 'HKU', ARRAY['IBDP', 'IGCSE']::text[], '• **IB 44/45** with Grade 7 in Math AI HL (Papers 1–3) and Economics HL (Papers 2–3) 📐

• **HKU IBGM Year 2** (International Business & Global Management) with a 3.92/4.30 GPA and HKU Entrance Scholarship 🎓

• **Case competition awards:** Gold at the HK Economic Olympiad; Merit at the HKU Internal Case Competition; IMMC Honours Award 🏆

• St. Stephen''s College graduate with 2+ years of online & in-person tutoring, including academic consulting for essay writing and university applications 👨‍🏫', '[]'::jsonb, '{}'::text[], NULL, 'IBDP 44/45', 'St. Stephen''s College', ARRAY['IB 44/45 | HKU IBGM Year 2 🎓', 'Math AI HL & Econ HL Grade 7 📐📊', 'HK Economic Olympiad Gold Medalist 🏆']::text[]),
  ('MM-T027', 'MM-T027', 'IB 42/45 | Boston College Mathematics 🎓 | SAT 1560 | Island School Graduate 🏫', ARRAY['Math AI HL', 'Math AA HL', 'Econ HL', 'Hist HL', 'Japanese AB Initio SL', 'Phys SL', 'Eng A Lang Lit SL']::text[], 'Within Kowloon', '{}'::text[], 250, 'Boston College Mathematics', false, 2, ARRAY['English', 'Cantonese']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Math AA HL"},{"grade":"7","subject":"Econ HL"},{"grade":"7","subject":"Phys SL"},{"grade":"7","subject":"Japanese AB Initio SL"},{"grade":"6","subject":"Hist HL"},{"grade":"6","subject":"Eng A Lang Lit SL"}]},{"system":"sat","subjects":[{"grade":"1560","subject":"SAT Total"}]}]'::jsonb, 'either', 'male', 'Boston College', ARRAY['IBDP', 'IGCSE', 'A-Level']::text[], '• **IB 42/45** with Grade 7 in Math AA HL, Economics HL, Physics SL & Japanese ab initio SL; **SAT 1560** 📊

• **Boston College Mathematics major** with mathematics offers across top US, UK & HK institutions 🎓

• Island School graduate (Class of ''26); recipient of the **Principal''s Award for Academic Excellence** 🎖️

• 2 years of tutoring across IGCSE and IB; guided a Math AA SL student **from Grade 3 to Grade 6 in 3 months** 📈

• Independent mastery of AP and A-Level syllabuses (Math, Physics, Economics) 📘', '[]'::jsonb, '{}'::text[], NULL, 'IBDP 42/45', 'Island School', ARRAY['IB 42/45 | Boston College Mathematics 🎓', 'Math AA HL & Econ HL Grade 7 | SAT 1560 📊', 'Student G3 → G6 in Math AA SL in 3 months 📈']::text[]),
  ('MM-T028', 'MM-T028', NULL, '{}'::text[], NULL, '{}'::text[], 500, NULL, false, NULL, '{}'::text[], '[]'::jsonb, 'either', 'male', NULL, '{}'::text[], NULL, '[]'::jsonb, '{}'::text[], NULL, NULL, NULL, '{}'::text[])
ON CONFLICT (tutor_code) DO NOTHING;

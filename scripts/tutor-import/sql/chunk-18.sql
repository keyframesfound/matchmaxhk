INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T085', 'MM-T085', 'HKU Law/PCLL Scholar 🏛️⚖️ | IELTS 9.0 | Elite Economics & Admissions Specialist 📈', ARRAY['Economics', 'A-Level Economics', 'IELTS']::text[], 'Within Hong Kong Island', ARRAY['HKU']::text[], 500, 'HKU Law LLB → PCLL', true, 4, ARRAY['English', 'Cantonese']::text[], '[{"system":"alevel","subjects":[{"grade":"A*","subject":"Economics"}]},{"system":"ielts","subjects":[{"grade":"9.0","subject":"IELTS Overall"}]}]'::jsonb, 'either', 'male', 'HKU', ARRAY['IBDP', 'A-Level', 'IGCSE', 'HKDSE']::text[], '• **HKU Law LLB graduate (Dean''s Honours List 2024/25 & 2025/26), now a PCLL candidate** ⚖️

• **A-Level A*A*AA** (Economics A*, Paper 3: 73/80) with **IELTS 9.0 perfect band** 🎯

• **95% of 15+ Economics tutees achieved A/A* or IB Grade 7** across IBDP, A-Level, IGCSE & HKDSE boards 📈

• **Admissions track record:** 10+ students into Cornell, Oxbridge, Durham, HKU, UCL, LSE & KCL (Common App, UCAS, Non-JUPAS) 🌍

• 4–5+ years of tutoring with custom question banks, notes, and curated readings; in person near HKU or online 💻', '[]'::jsonb, '{}'::text[], NULL, 'IELTS 9.0 | A-Level Econ A*', 'Wymondham College (UK)', ARRAY['HKU Law LLB (Dean''s List ×2) → PCLL ⚖️', 'IELTS 9.0 Perfect Band | A-Level Econ A* 🎯', '10+ Students Into Cornell, Oxbridge, LSE… 🌍']::text[]),
  ('MM-T086', 'MM-T086', 'HKUMed Scholar & Experienced Science Tutor 🩺🧬 | HKDSE 33 (Geog 5*) | Multi-Curriculum Specialist 🎯', ARRAY['Biology', 'Geography', 'English', 'IGCSE Biology', 'IGCSE Geography']::text[], 'Within Hong Kong Island', '{}'::text[], 350, 'HKUMed (HKU)', true, 4, ARRAY['English']::text[], '[{"system":"dse","subjects":[{"grade":"5*","subject":"Geography"},{"grade":"5","subject":"Biology"}]}]'::jsonb, 'either', 'male', 'HKU', ARRAY['IBDP', 'IGCSE', 'HKDSE', 'Junior Secondary']::text[], '• **HKDSE 33 points** with Geography 5* and Biology 5; completed DSE, GCSE, GCE AS & IELTS 🏅

• **HKUMed Entrance Scholarship & Taufik Ali Memorial Scholarship** (yearly recipient, 2022–2026) 🏆

• **4+ years of professional tutoring** at A-Square Education and Bridge Elite Education 🏫

• Facilitated clinical workshops and medical simulations at HKUMed 🩺

• Documented +1 to +2 grade uplifts across IB, IGCSE & DSE; MMI and medical interview coaching 🎯

• Online or in-person (HK Island / Kowloon) in 100% English 💻', '[]'::jsonb, '{}'::text[], NULL, 'HKDSE 33 | Geography 5*', 'Po Leung Kuk Ngan Po Ling College', ARRAY['HKUMed Entrance Scholarship (2022–2026) 🏆', 'HKDSE 33 | Geography 5*, Biology 5 🌍🧬', '4+ Yrs at A-Square & Bridge Elite 🏫']::text[]),
  ('MM-T087', 'MM-T087', NULL, ARRAY['Economics']::text[], NULL, '{}'::text[], 1300, NULL, true, NULL, ARRAY['English']::text[], '[]'::jsonb, 'online', 'male', NULL, ARRAY['IBDP']::text[], NULL, '[]'::jsonb, '{}'::text[], NULL, NULL, NULL, '{}'::text[]),
  ('MM-T088', 'MM-T088', 'IB 44/45 🏅 | University of Warwick, BSc Economics & Management 🎓 | Math AI & Economics Specialist 🎯', ARRAY['Math AI HL', 'Econ HL', 'Eng A Lang Lit SL', 'Spanish AB Initio SL']::text[], NULL, '{}'::text[], 250, 'Warwick Economics & Management', true, NULL, ARRAY['English']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Math AI HL"},{"grade":"7","subject":"Econ HL"},{"grade":"7","subject":"Spanish AB Initio SL"}]}]'::jsonb, 'online', 'female', 'University of Warwick', ARRAY['IBDP']::text[], '• **IB 44/45** with Grade 7 in Math AI HL (highest school exam mark), Economics HL & Spanish ab initio SL 🏅

• **University of Warwick — BSc Economics and Management** (2026 intake) 🎓

• **Economics HL & Spanish ab initio Subject Prize winner** 🏆

• Current university student offering fresh IBDP curriculum insight, targeted exam drilling, and Paper 1 analysis coaching 📝

• Online lessons 💻', '[]'::jsonb, '{}'::text[], NULL, 'IBDP 44/45', NULL, ARRAY['IB 44/45 | Warwick Economics & Management 🎓', 'Math AI HL & Econ HL Grade 7 📐📊', 'Double Subject Prize Winner (Econ & Spanish) 🏆']::text[])
ON CONFLICT (tutor_code) DO NOTHING;

INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T095', 'MM-T095', NULL, '{}'::text[], NULL, '{}'::text[], 150, NULL, false, NULL, '{}'::text[], '[]'::jsonb, 'either', 'female', NULL, '{}'::text[], NULL, '[]'::jsonb, '{}'::text[], NULL, NULL, NULL, '{}'::text[]),
  ('MM-T096', 'MM-T096', 'Oxford PhD Scholar & Perfect Scorer (IB 45/45) 🏛️📚 | Elite English Literature & Geography Specialist 🎯', ARRAY['Eng Lit HL', 'Eng A Lang Lit HL', 'Geog HL']::text[], NULL, '{}'::text[], 600, 'Oxford PhD Candidate (English Lit)', true, 7, ARRAY['English']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Eng Lit HL"},{"grade":"7","subject":"Geog HL"},{"grade":"7","subject":"Econ HL"}]}]'::jsonb, 'online', 'female', 'University of Oxford', ARRAY['IBDP', 'IGCSE']::text[], '• **Perfect IB 45/45** with Grade 7 in English Literature A HL, Geography HL, Economics HL, Biology SL, Chinese B SL & Math SL 🏅

• **Oxford PhD candidate in English Literature** with a First Class Oxford BA 🎓

• **HKJC Graduate Scholarship & D.H. Chen Foundation Scholarship** (full funding); **Rhodes Scholar Finalist 2025** 🏆

• **7+ years of elite tutoring** across HK, UK & NZ; tutees admitted to institutions including UPenn 🌍

• Champion & 2nd Best Speaker, Oxford Novice Debate Tournament 2026; WSC Yale writing world #2 🗣️

• Online-only with literary analysis rubrics, essay templates, and past-paper sets 💻', '[]'::jsonb, ARRAY['IA', 'EE']::text[], NULL, 'IBDP 45/45', 'King George V School (KGV)', ARRAY['IB 45/45 Perfect Scorer | Oxford PhD Candidate 🏛️', 'HKJC + D.H. Chen Full Scholarships | Rhodes Finalist 🏆', '7+ Yrs Elite Tutoring | UPenn Admissions Track 🌍']::text[]),
  ('MM-T097', 'MM-T097', 'M.Tech VLSI (Engineering) 🎓 | B.Tech ECE 83% | Math, Physics & Science Specialist 🔬', ARRAY['Mathematics', 'Physics', 'Science']::text[], NULL, '{}'::text[], 300, 'M.Tech VLSI (in progress)', false, 1, ARRAY['English']::text[], '[{"system":"other","subjects":[{"grade":"93/100","subject":"Mathematics"},{"grade":"83/100","subject":"Physics"},{"grade":"78/100","subject":"Science"}]}]'::jsonb, 'online', 'female', 'Assam University', ARRAY['Junior Secondary', 'Senior Secondary']::text[], '• **B.Tech in Electronics & Communication Engineering — 83%** with Mathematics 93/100 and Physics 83/100 ⚡

• Pursuing **M.Tech in VLSI at Assam University, Silchar** 🔬

• **National Scholarship Portal (NSP) for PG students** and the **Anundaram Boruah Award (2019)** 📜

• 1 year of practical tutoring in Mathematics, Science & Physics 👨‍🏫

• Online-only lessons in 100% English medium 💻', '[]'::jsonb, '{}'::text[], NULL, 'B.Tech ECE 83% | M.Tech VLSI', NULL, ARRAY['B.Tech ECE 83% | M.Tech VLSI Candidate 🎓', 'Math 93/100 | Physics 83/100 ➗🧲', 'NSP Scholarship & Anundaram Boruah Award 📜']::text[]),
  ('MM-T098', 'MM-T098', 'HKU Dental Surgery (BDS) 🦷 | IB 41 (Straight 7s) 🎯 | Biology, Psychology & English Lit Specialist 🧬🧠', ARRAY['Bio HL', 'Psych SL', 'Eng Lit SL']::text[], NULL, '{}'::text[], 400, 'HKU Dental Surgery (BDS)', true, 2, ARRAY['English']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Bio HL"},{"grade":"7","subject":"Psych SL"},{"grade":"7","subject":"Eng Lit SL"}]}]'::jsonb, 'online', 'female', 'HKU', ARRAY['IBDP']::text[], '• **IB 41/45 with straight Grade 7s** across HL and SL subjects 🎯

• Admitted to **HKU Bachelor of Dental Surgery (BDS)** — one of Asia''s most competitive dental programs 🦷

• **The ISF Academy Shuyuan Honorary Scholarship in Science and Technology (2024–25)** 🏅

• Grade 7 in Biology HL, Psychology SL & English Literature SL with 2 years of tutoring experience 📚

• Online-only lessons in 100% English with TOK and General Science support 💻', '[]'::jsonb, ARRAY['TOK']::text[], NULL, 'IBDP 41/45 (Straight 7s)', 'The ISF Academy', ARRAY['HKU BDS (Dental Surgery) Offer 🦷', 'IB 41/45 — Grade 7 in every subject 🎯', 'ISF Shuyuan Science & Tech Scholarship 🏅']::text[])
ON CONFLICT (tutor_code) DO NOTHING;

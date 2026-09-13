INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T057', 'MM-T057', NULL, '{}'::text[], NULL, '{}'::text[], 150, NULL, false, NULL, '{}'::text[], '[]'::jsonb, 'either', 'female', NULL, '{}'::text[], NULL, '[]'::jsonb, '{}'::text[], NULL, NULL, NULL, '{}'::text[]),
  ('MM-T058', 'MM-T058', 'HKU MBBS / MRes 🩺 | A-Level 4A* & iGCSE 8A* 🏆 | Biology & STEM Specialist 🧬', ARRAY['A-Level Biology', 'A-Level Chemistry', 'A-Level Mathematics', 'A-Level Economics', 'IGCSE Biology', 'IGCSE Economics']::text[], 'Within Kowloon', ARRAY['Sung Wong Toi']::text[], 300, 'HKU Medicine (MBBS + MRes)', true, NULL, ARRAY['English']::text[], '[{"system":"alevel","subjects":[{"grade":"A*","subject":"Biology"},{"grade":"A*","subject":"Chemistry"},{"grade":"A*","subject":"Mathematics"},{"grade":"A*","subject":"Economics"}]},{"system":"igcse","subjects":[{"grade":"A*","subject":"8A* overall (Grade 9)"}]}]'::jsonb, 'either', 'male', 'HKU', ARRAY['A-Level', 'IGCSE']::text[], '• **HKU MBBS student undertaking a Master of Research (MRes)** 🩺

• **A-Level 4A\*** (Biology, Chemistry, Mathematics & Economics) from Concord College (UK, 2024); **Rank #1 in A-Level Biology** 🧬

• **iGCSE 8A* / Grade 9** (KGV, 2022) with the KGV iGCSE Academic Award 🌟

• **HKUMed Dean''s Scholarship** recipient; Imperial College Medicine Teams Challenge certificate 🏛️

• 100% English medium of instruction with custom notes and topical practice papers 📝', '[]'::jsonb, '{}'::text[], NULL, 'A-Level 4A* | iGCSE 8A*', 'King George V School (KGV)', ARRAY['HKU MBBS + Master of Research (MRes) 🩺', 'A-Level 4A* | Rank #1 Biology at Concord 🧬', 'iGCSE 8A* | HKUMed Dean''s Scholarship 📜']::text[]),
  ('MM-T060', 'MM-T060', 'HKU Nursing 🩺 | IB 39/45 🏆 | Chinese A & Math AA SL Specialist 🇨🇳📐', ARRAY['Chin A Lang Lit SL', 'Math AA SL']::text[], 'Within New Territories', ARRAY['Yuen Long']::text[], 300, 'HKU Nursing', true, NULL, ARRAY['Cantonese', 'Mandarin', 'English']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Chin A Lang Lit SL"},{"grade":"7","subject":"Math AA SL"}]}]'::jsonb, 'either', 'female', 'HKU', ARRAY['IBDP', 'Junior Secondary', 'Primary']::text[], '• **IB 39/45** with **Grade 7 (highest marks) in Chinese A Lang & Lit SL and Math AA SL** 🏅

• Incoming **Bachelor of Nursing at The University of Hong Kong (HKU)** (2026 entry) 🩺

• Structured answer techniques for Chinese A commentary/essay writing and step-by-step Math AA problem-solving 📝

• Custom practice papers, revision guides, and structured notes provided 📑

• Bilingual instruction (Cantonese / Mandarin / English) 🇨🇳🇭🇰', '[]'::jsonb, '{}'::text[], NULL, 'IBDP 39/45', NULL, ARRAY['IB 39/45 | HKU Nursing Student 🩺', 'Chinese A & Math AA SL Grade 7 🇨🇳📐', 'Custom notes, model essays & practice sets 📝']::text[]),
  ('MM-T061', 'MM-T061', NULL, '{}'::text[], NULL, '{}'::text[], 150, NULL, false, NULL, '{}'::text[], '[]'::jsonb, 'either', NULL, NULL, '{}'::text[], NULL, '[]'::jsonb, '{}'::text[], NULL, NULL, NULL, '{}'::text[])
ON CONFLICT (tutor_code) DO NOTHING;

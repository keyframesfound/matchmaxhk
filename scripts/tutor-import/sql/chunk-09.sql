INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T045', 'MM-T045', 'IB Chemistry, Biology, Mathematics, English, Chinese & Economics 🎯', ARRAY['Chemistry', 'Biology', 'Mathematics', 'English', 'Chinese', 'Economics']::text[], NULL, '{}'::text[], 350, NULL, true, NULL, ARRAY['English']::text[], '[]'::jsonb, 'online', 'male', NULL, ARRAY['IBDP']::text[], '• Online IB tutoring across Chemistry, Biology, Mathematics, English, Chinese & Economics 📚

• Online lessons only 💻', '[]'::jsonb, '{}'::text[], NULL, NULL, NULL, '{}'::text[]),
  ('MM-T046', 'MM-T046', 'IB 38/45 🏅 | Renaissance College Graduate 🎓 | CUHK Psychology Student 🧠', ARRAY['Psych HL', 'Psych SL']::text[], 'Within Kowloon', '{}'::text[], 300, 'CUHK Psychology', true, NULL, ARRAY['English', 'Cantonese']::text[], '[{"system":"ib","subjects":[{"grade":"","subject":"IBDP"}]}]'::jsonb, 'either', 'female', 'CUHK', ARRAY['IBDP', 'MYP', 'Primary']::text[], '• **IB 38/45** graduate currently pursuing a **Bachelor of Psychology at CUHK** 🎓

• Renaissance College Hong Kong (Class of 2025) graduate; previously at St. Catharine''s School for Girls 🎒

• **SEN & child support experience:** intern at U.P. Behaviour Consulting and classroom assistant at Jockey Club Sarah Roe School 🧸

• Active private tutor since 2025, adapting lessons to individual needs with customized revision plans 👨‍🏫

• IBDP / MYP / IGCSE / local curriculum coaching plus primary & early-secondary support 📝', '[]'::jsonb, '{}'::text[], NULL, 'IBDP 38/45', 'Renaissance College Hong Kong', ARRAY['IB 38/45 | CUHK Psychology Student 🧠', 'SEN Experience: U.P. Behaviour & JC Sarah Roe 🧸', 'Customized revision plans since 2025 📝']::text[]),
  ('MM-T047', 'MM-T047', 'HKU Biological Sciences 🔬 | IB 40/45 🎯 | VSA Alumnus & Experienced Science Educator 🧬', ARRAY['Bio HL', 'Geog HL', 'Eng A Lang Lit HL', 'Chem SL', 'Math AA SL', 'Spanish AB Initio SL']::text[], 'Open to Discussion', '{}'::text[], 350, 'HKU Biological Sciences', true, NULL, ARRAY['English']::text[], '[{"system":"ib","subjects":[{"grade":"6","subject":"Bio HL"},{"grade":"6","subject":"Geog HL"},{"grade":"6","subject":"Eng A Lang Lit HL"},{"grade":"6","subject":"Chem SL"},{"grade":"6","subject":"Math AA SL"},{"grade":"7","subject":"Spanish AB Initio SL"}]}]'::jsonb, 'either', 'male', 'HKU', ARRAY['IBDP', 'MYP']::text[], '• **IB 40/45** with Spanish ab initio Grade 7 and full 3/3 core marks (TOK A | EE B) 🏅

• Current **HKU Biological Sciences** undergraduate; Victoria Shanghai Academy (Class of 2026) graduate 🎓

• **Field & conservation experience:** marine biology intern with the Hong Kong Shark Foundation, veterinary support at the HK Rabbit Society, and Paws United Charity wildlife rescue 🦈

• **Kids4Kids Student Teacher** designing interactive lessons; Head of Hydroponics and founder of the Aquascapers Club 🌱

• CPR certified by HKU and SPCA Canine First Aid certified 🩹', '[]'::jsonb, '{}'::text[], NULL, 'IBDP 40/45', 'Victoria Shanghai Academy (VSA)', ARRAY['IB 40/45 | HKU Biological Sciences 🔬', 'HK Shark Foundation Marine Bio Intern 🦈', 'Kids4Kids Student Teacher | VSA Class of 2026 🎒']::text[]),
  ('MM-T048', 'MM-T048', 'A-Level Top Scorer 🏅 | St Andrews Medicine 🩺 | GCSE & A-Level Science Mentor 🧪🧬', ARRAY['A-Level Chemistry', 'A-Level Biology', 'IGCSE Chemistry', 'IGCSE Biology']::text[], NULL, '{}'::text[], 580, 'St Andrews Medicine', true, 3, ARRAY['English']::text[], '[{"system":"alevel","subjects":[{"grade":"A* A A","subject":"A-Level Profile"}]}]'::jsonb, 'online', 'female', 'University of St Andrews', ARRAY['A-Level', 'IGCSE']::text[], '• **A-Level results A* A A** with specialisms in Chemistry & Biology 🧪🧬

• Currently studying **Medicine at the University of St Andrews** 🩺

• **3 years of teaching experience** with 4 currently active students 👨‍🏫

• GCSE & A-Level Chemistry and Biology concept mastery with exam preparation 📐

• Online tutoring only 💻', '[]'::jsonb, '{}'::text[], NULL, 'A-Level A* A A', NULL, ARRAY['A-Level A* A A | Chem & Bio Specialist 🧪🧬', 'University of St Andrews Medicine 🩺', '3 Yrs Teaching | 4 Active Students 👨‍🏫']::text[])
ON CONFLICT (tutor_code) DO NOTHING;

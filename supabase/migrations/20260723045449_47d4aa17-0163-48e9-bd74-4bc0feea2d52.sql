
CREATE POLICY "Tutor photos are readable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'tutor-photos');

CREATE POLICY "Admins can upload tutor photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tutor-photos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Admins can update tutor photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tutor-photos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Admins can delete tutor photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tutor-photos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff')));

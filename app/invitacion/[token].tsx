// OBSOLETO — la app ya no usa links/tokens de invitación (ver decisión del 2026-08-23).
// Este archivo queda vacío a propósito porque OneDrive impide borrarlo desde el entorno de
// trabajo; bórralo tú manualmente con `git rm` (ver instrucciones al final de la sesión) para
// que deje de existir en el repo. Mientras tanto, si alguien abre un link viejo
// "frontendappmedv2://invitacion/...", esta pantalla no hace nada dañino: solo redirige al
// inicio de la app.
import { Redirect } from 'expo-router';
import React from 'react';

export default function InvitacionRouteObsoleta() {
  return <Redirect href="/" />;
}

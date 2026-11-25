SET NAMES utf8mb4;
SET time_zone = '-05:00';

-- 1. Usuarios administradores (único rol). active: 1 = activo, 0 = desactivado
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  active        TINYINT NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL,
  last_login    DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Moldes (imagen de fondo + campos en JSON)
CREATE TABLE IF NOT EXISTS templates (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(160) NOT NULL,
  image_path  VARCHAR(190) NOT NULL,
  width       INT UNSIGNED NOT NULL,
  height      INT UNSIGNED NOT NULL,
  fields_json MEDIUMTEXT NOT NULL,
  pages_json  MEDIUMTEXT NULL,
  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2b. Empresas que dictan los cursos (se muestran en la página pública del certificado). logo: archivo en uploads/templates
CREATE TABLE IF NOT EXISTS companies (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  logo       VARCHAR(64)  NOT NULL DEFAULT '',
  website    VARCHAR(190) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Cursos y talleres
--    kind: 'curso' | 'taller' · cert_type: 'con_notas' | 'sin_notas'
CREATE TABLE IF NOT EXISTS courses (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(200) NOT NULL,
  kind         VARCHAR(10)  NOT NULL,
  cert_type    VARCHAR(12)  NOT NULL,
  hours        INT UNSIGNED NOT NULL,
  scale_max    DECIMAL(5,2) NOT NULL DEFAULT 20,
  min_grade    DECIMAL(5,2) NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  template_id  INT UNSIGNED NULL,
  company_id   INT UNSIGNED NULL,
  print_grade  TINYINT NOT NULL DEFAULT 0,
  w_attendance DECIMAL(5,2) NOT NULL DEFAULT 0,
  w_workshops  DECIMAL(5,2) NOT NULL DEFAULT 0,
  w_modular    DECIMAL(5,2) NOT NULL DEFAULT 0,
  w_final      DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL,
  updated_at   DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_courses_template (template_id),
  KEY idx_courses_dates (start_date),
  CONSTRAINT fk_courses_template FOREIGN KEY (template_id) REFERENCES templates (id),
  CONSTRAINT fk_courses_company FOREIGN KEY (company_id) REFERENCES companies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Participantes (con notas)
CREATE TABLE IF NOT EXISTS participants (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id    INT UNSIGNED NOT NULL,
  doc_id       VARCHAR(30)  NOT NULL,
  full_name    VARCHAR(200) NOT NULL,
  email        VARCHAR(190) NULL,
  g_attendance DECIMAL(5,2) NULL,
  g_workshops  DECIMAL(5,2) NULL,
  g_modular    DECIMAL(5,2) NULL,
  g_final      DECIMAL(5,2) NULL,
  final_grade  DECIMAL(5,2) NULL,
  passed       TINYINT NULL,
  created_at   DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_participant_course_doc (course_id, doc_id),
  CONSTRAINT fk_participants_course FOREIGN KEY (course_id) REFERENCES courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Certificados emitidos · status: 'valid' | 'revoked'
-- vars_json (certificates): textos con los que se emitió (nombre, curso, fechas, horas, nota): no cambian al editar después.
-- 4b. Versiones congeladas de los moldes: copia del diseño (fila de templates en JSON) con la que se emitió cada certificado.
--     Editar o cambiar el molde de un curso no altera los certificados ya emitidos. hash: reutiliza una copia idéntica.
CREATE TABLE IF NOT EXISTS template_versions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_id INT UNSIGNED NULL,
  hash        CHAR(40) NOT NULL,
  row_json    MEDIUMTEXT NOT NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tv_template (template_id, hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificates (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code           CHAR(12) NOT NULL,
  participant_id INT UNSIGNED NOT NULL,
  course_id      INT UNSIGNED NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'valid',
  issued_at      DATETIME NOT NULL,
  revoked_at     DATETIME NULL,
  revoked_reason VARCHAR(300) NULL,
  revoked_by     INT UNSIGNED NULL,
  template_version_id INT UNSIGNED NULL,
  vars_json      TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cert_code (code),
  UNIQUE KEY uq_cert_participant (participant_id),
  KEY idx_cert_course (course_id),
  CONSTRAINT fk_cert_participant FOREIGN KEY (participant_id) REFERENCES participants (id),
  CONSTRAINT fk_cert_course FOREIGN KEY (course_id) REFERENCES courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Límite de intentos (login y consultas públicas)
CREATE TABLE IF NOT EXISTS throttle (
  k        VARCHAR(120) NOT NULL,
  hits     INT UNSIGNED NOT NULL,
  reset_at INT UNSIGNED NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Ajustes (site_name, base_url)
CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(60) NOT NULL,
  v TEXT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

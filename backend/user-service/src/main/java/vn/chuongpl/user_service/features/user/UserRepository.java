package vn.chuongpl.user_service.features.user;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;


@Repository
public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByFullName(String fullName);
    Optional<User> findByEmail(String email);
    List<User> findAllByEmail(String email);
    Optional<User> findByPhone(String phone);
    Boolean existsByEmail(String email);

    boolean existsByEmailAndDeletedFalse(String email);
    boolean existsByPhoneAndDeletedFalse(String phone);

    Optional<User> findByEmailAndDeletedFalse(String email);

    Optional<User> findByIdAndDeletedFalse(String id);
//    Optional<User> findByIdAndDeletedFalse(String id);
    Page<User> findByRolesIn(List<String> roles , Pageable pageable);
    Page<User> findByRoles_NameIn(List<String> roleNames, Pageable pageable);
}
